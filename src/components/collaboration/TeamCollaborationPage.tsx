
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Users, UserPlus, ShieldCheck, PlusCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SkeletonBlock from '../ui/SkeletonBlock';
import EmptyState from '../ui/EmptyState';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Organization = {
  id: number;
  name: string;
  seat_limit?: number;
  member_count?: number;
  pending_invites?: number;
};

type Member = {
  id: number;
  name?: string;
  email: string;
  role: string;
  last_login?: string | null;
};

type Team = {
  id: number;
  name: string;
  description?: string | null;
  members: Member[];
};

const TeamCollaborationPage: React.FC = () => {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  const [seatLimit, setSeatLimit] = useState('');
  const [teamForm, setTeamForm] = useState({ name: '', description: '' });
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'developer',
    teamIds: [] as number[]
  });
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<number, string>>({});
  const [teamMemberSelection, setTeamMemberSelection] = useState<Record<number, string>>({});

  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const seatUsage = useMemo(() => {
    if (!organization) {
      return { used: 0, limit: 0, pending: 0 };
    }
    const used = organization.member_count || 0;
    const pending = organization.pending_invites || 0;
    const limit = organization.seat_limit || 0;
    return { used, pending, limit };
  }, [organization]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [orgRes, membersRes, teamsRes] = await Promise.all([
        axios.get(`${API_URL}/api/organizations`),
        axios.get(`${API_URL}/api/organizations/members`),
        axios.get(`${API_URL}/api/teams`)
      ]);

      setOrganization(orgRes.data);
      setSeatLimit(orgRes.data.seat_limit ? String(orgRes.data.seat_limit) : '');
      setMembers(membersRes.data);
      setMemberRoleDrafts(
        membersRes.data.reduce((acc: Record<number, string>, member: Member) => {
          acc[member.id] = member.role;
          return acc;
        }, {})
      );
      setTeams(teamsRes.data);
    } catch (err) {
      console.error('Failed to load team data:', err);
      setError('Unable to load team data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSeatLimitSave = async () => {
    setError('');
    setStatus('');
    if (!isManager) {
      setError('You do not have permission to update seat limits.');
      return;
    }
    if (!seatLimit || Number.isNaN(Number(seatLimit)) || Number(seatLimit) < 1) {
      setError('Seat limit must be a positive number.');
      return;
    }

    try {
      await axios.put(`${API_URL}/api/organizations/seat-limit`, {
        seat_limit: Number(seatLimit)
      });
      setStatus('Seat limit updated.');
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update seat limit.');
    }
  };

  const handleCreateTeam = async () => {
    setError('');
    setStatus('');
    if (!isManager) {
      setError('You do not have permission to create teams.');
      return;
    }
    if (!teamForm.name.trim()) {
      setError('Team name is required.');
      return;
    }

    try {
      await axios.post(`${API_URL}/api/teams`, {
        name: teamForm.name.trim(),
        description: teamForm.description.trim()
      });
      setTeamForm({ name: '', description: '' });
      setStatus('Team created successfully.');
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create team.');
    }
  };

  const handleInvite = async () => {
    setError('');
    setStatus('');
    setInviteLink('');
    setInviteLinkCopied(false);

    if (!isManager) {
      setError('You do not have permission to invite members.');
      return;
    }

    if (!inviteForm.email.trim()) {
      setError('Email is required to send an invite.');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/api/organizations/invites`, {
        email: inviteForm.email.trim(),
        role: inviteForm.role,
        team_ids: inviteForm.teamIds
      });
      setInviteForm({ email: '', role: 'developer', teamIds: [] });
      if (response.data?.email_sent === false && response.data?.invite_link) {
        setStatus('Invite created. Email delivery failed, please copy the link below.');
        setInviteLink(response.data.invite_link);
      } else {
        setStatus('Invite sent successfully.');
      }
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send invite.');
    }
  };

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteLinkCopied(true);
      setStatus('Invite link copied to clipboard.');
    } catch (error) {
      setError('Failed to copy invite link.');
    }
  };

  const toggleTeamSelection = (teamId: number) => {
    setInviteForm((prev) => {
      const exists = prev.teamIds.includes(teamId);
      return {
        ...prev,
        teamIds: exists ? prev.teamIds.filter((id) => id !== teamId) : [...prev.teamIds, teamId]
      };
    });
  };

  const handleRoleSave = async (memberId: number) => {
    setError('');
    setStatus('');
    if (!isManager) {
      setError('You do not have permission to update roles.');
      return;
    }
    if (memberId === user?.id) {
      setError('You cannot change your own role.');
      return;
    }

    const role = memberRoleDrafts[memberId];
    try {
      await axios.put(`${API_URL}/api/organizations/members/${memberId}/role`, { role });
      setStatus('Role updated.');
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update role.');
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    setError('');
    setStatus('');
    if (!isManager) {
      setError('You do not have permission to remove members.');
      return;
    }
    if (memberId === user?.id) {
      setError('You cannot remove yourself.');
      return;
    }
    try {
      await axios.delete(`${API_URL}/api/organizations/members/${memberId}`);
      setStatus('Member removed.');
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove member.');
    }
  };

  const handleAddTeamMember = async (teamId: number) => {
    setError('');
    setStatus('');
    if (!isManager) {
      setError('You do not have permission to manage team members.');
      return;
    }
    const memberId = Number(teamMemberSelection[teamId]);
    if (!memberId) {
      setError('Select a member to add.');
      return;
    }
    try {
      await axios.post(`${API_URL}/api/teams/${teamId}/members`, { userId: memberId });
      setTeamMemberSelection((prev) => ({ ...prev, [teamId]: '' }));
      setStatus('Member added to team.');
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add member.');
    }
  };

  const handleRemoveTeamMember = async (teamId: number, memberId: number) => {
    setError('');
    setStatus('');
    if (!isManager) {
      setError('You do not have permission to manage team members.');
      return;
    }
    try {
      await axios.delete(`${API_URL}/api/teams/${teamId}/members/${memberId}`);
      setStatus('Member removed from team.');
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove member from team.');
    }
  };

  if (loading) {
    return (
      <div className="pt-20 min-h-screen bg-aikya">
        <div className="container mx-auto px-6 py-8 space-y-6">
          <SkeletonBlock className="h-16" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SkeletonBlock className="h-64" />
            <SkeletonBlock className="h-64 lg:col-span-2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen bg-aikya">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Teams & Access</h1>
              <p className="text-slate-400">
                Create teams, invite teammates, and manage access per organization.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 text-sm text-amber-200">
              <ShieldCheck className="h-4 w-4 text-amber-300" />
              Organization-isolated by design
            </div>
          </div>
        </div>

        {status && (
          <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {status}
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Organization seats</h2>
                  <p className="text-sm text-slate-400">
                    Track how many teammates can join this workspace.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Active + pending</p>
                  <p className="text-xl font-semibold text-white">
                    {seatUsage.used + seatUsage.pending} / {seatUsage.limit || '?'}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <div className="h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-teal-500"
                    style={{
                      width: seatUsage.limit
                        ? `${Math.min(100, ((seatUsage.used + seatUsage.pending) / seatUsage.limit) * 100)}%`
                        : '0%'
                    }}
                  ></div>
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  Active members: {seatUsage.used} | Pending invites: {seatUsage.pending}
                </div>
              </div>

              {isManager && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    value={seatLimit}
                    onChange={(event) => setSeatLimit(event.target.value)}
                    className="w-32 p-2 rounded-lg bg-white/10 border border-white/20 text-white focus:border-amber-400 focus:outline-none"
                    placeholder="Seats"
                  />
                  <button
                    onClick={handleSeatLimitSave}
                    className="px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                  >
                    Save seat limit
                  </button>
                  <span className="text-xs text-slate-400">
                    Update this based on your plan to keep billing aligned.
                  </span>
                </div>
              )}
            </div>

            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Teams</h2>
                  <p className="text-sm text-slate-400">Keep access scoped by function or product.</p>
                </div>
                <PlusCircle className="h-5 w-5 text-amber-300" />
              </div>

              {isManager && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={teamForm.name}
                    onChange={(event) => setTeamForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                    placeholder="Team name"
                  />
                  <input
                    type="text"
                    value={teamForm.description}
                    onChange={(event) => setTeamForm((prev) => ({ ...prev, description: event.target.value }))}
                    className="p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                    placeholder="Description (optional)"
                  />
                  <button
                    onClick={handleCreateTeam}
                    className="px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                  >
                    Create team
                  </button>
                </div>
              )}

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map((team) => (
                  <div key={team.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-white font-semibold">{team.name}</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          {team.description || 'No description yet.'}
                        </p>
                      </div>
                      <span className="text-xs text-slate-300 bg-white/10 px-2 py-1 rounded-full">
                        {team.members.length} members
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {team.members.length === 0 && (
                        <p className="text-xs text-slate-500">No members assigned yet.</p>
                      )}
                      {team.members.map((member) => (
                        <div key={member.id} className="text-xs text-slate-300 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Users className="h-3 w-3 text-slate-500" />
                            <span>{member.name || member.email}</span>
                          </div>
                          {isManager && (
                            <button
                              onClick={() => handleRemoveTeamMember(team.id, member.id)}
                              className="text-[11px] text-rose-300 hover:text-rose-200"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {isManager && (
                      <div className="mt-4">
                        <p className="text-xs text-slate-400 mb-2">Add member</p>
                        <div className="flex items-center gap-2">
                          <select
                            value={teamMemberSelection[team.id] || ''}
                            onChange={(event) =>
                              setTeamMemberSelection((prev) => ({ ...prev, [team.id]: event.target.value }))
                            }
                            className="flex-1 p-2 rounded-lg bg-white/10 border border-white/20 text-white focus:border-amber-400 focus:outline-none"
                          >
                            <option value="" className="bg-slate-900 text-slate-100">Select member</option>
                            {members
                              .filter((member) => !team.members.some((assigned) => assigned.id === member.id))
                              .map((member) => (
                                <option key={member.id} value={member.id} className="bg-slate-900 text-slate-100">
                                  {member.name || member.email}
                                </option>
                              ))}
                          </select>
                          <button
                            onClick={() => handleAddTeamMember(team.id)}
                            className="px-3 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                          >
                            Add
                          </button>
                        </div>
                        {members.filter((member) => !team.members.some((assigned) => assigned.id === member.id)).length === 0 && (
                          <p className="text-xs text-slate-500 mt-2">All members are already in this team.</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {teams.length === 0 && (
                  <div className="md:col-span-2">
                    <EmptyState
                      title="No teams yet"
                      message="Create your first team to organize access and responsibilities."
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-amber-300" />
                <h2 className="text-lg font-semibold text-white">Invite teammate</h2>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                Send a secure invite by email. They will join this organization automatically after accepting.
              </p>

              <div className="mt-4 space-y-4">
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                  placeholder="teammate@company.com"
                />

                <select
                  value={inviteForm.role}
                  onChange={(event) => setInviteForm((prev) => ({ ...prev, role: event.target.value }))}
                  className="w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="developer" className="bg-slate-900 text-slate-100">Developer</option>
                  <option value="admin" className="bg-slate-900 text-slate-100">Admin</option>
                  <option value="manager" className="bg-slate-900 text-slate-100">Manager</option>
                  <option value="viewer" className="bg-slate-900 text-slate-100">Viewer</option>
                </select>

                <div>
                  <p className="text-xs text-slate-400 mb-2">Assign teams (optional)</p>
                  <div className="space-y-2">
                    {teams.map((team) => (
                      <label key={team.id} className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          checked={inviteForm.teamIds.includes(team.id)}
                          onChange={() => toggleTeamSelection(team.id)}
                          className="h-4 w-4 rounded border-white/20 bg-white/10 text-amber-500 focus:ring-amber-400"
                        />
                        <span>{team.name}</span>
                      </label>
                    ))}
                    {teams.length === 0 && (
                      <p className="text-xs text-slate-500">Create a team to assign access.</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleInvite}
                  disabled={!isManager}
                  className="w-full px-4 py-3 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  Send invite
                </button>
                {!isManager && (
                  <p className="text-xs text-slate-500">Only managers can invite new members.</p>
                )}
                {inviteLink && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
                    <p className="text-slate-400 mb-2">Invite link (share securely):</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="break-all">{inviteLink}</span>
                      <button
                        onClick={handleCopyInviteLink}
                        className="text-amber-300 hover:text-amber-200 text-xs"
                      >
                        {inviteLinkCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white">Members</h2>
              <p className="text-sm text-slate-400 mt-1">
                Everyone listed here belongs to this organization.
              </p>
              <div className="mt-4 space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">{member.name || member.email}</p>
                      <p className="text-xs text-slate-400">{member.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isManager ? (
                        <>
                          <select
                            value={memberRoleDrafts[member.id] || member.role}
                            onChange={(event) =>
                              setMemberRoleDrafts((prev) => ({ ...prev, [member.id]: event.target.value }))
                            }
                            className="text-xs bg-white/10 border border-white/20 text-white rounded-md px-2 py-1 focus:border-amber-400 focus:outline-none"
                          >
                            <option value="developer" className="bg-slate-900 text-slate-100">Developer</option>
                            <option value="admin" className="bg-slate-900 text-slate-100">Admin</option>
                            <option value="manager" className="bg-slate-900 text-slate-100">Manager</option>
                            <option value="viewer" className="bg-slate-900 text-slate-100">Viewer</option>
                            <option value="user" className="bg-slate-900 text-slate-100">User</option>
                          </select>
                          <button
                            onClick={() => handleRoleSave(member.id)}
                            disabled={memberRoleDrafts[member.id] === member.role || member.id === user?.id}
                            className="text-xs text-amber-300 hover:text-amber-200 disabled:opacity-40"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={member.id === user?.id}
                            className="text-xs text-rose-300 hover:text-rose-200 disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-300 bg-white/10 px-2 py-1 rounded-full capitalize">
                          {member.role}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {members.length === 0 && (
                  <p className="text-sm text-slate-500">No members found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamCollaborationPage;
