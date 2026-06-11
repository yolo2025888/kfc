import {SupabaseClient} from "@supabase/supabase-js";
import {Database} from "@/lib/types";

type TaskInsertPayload = Omit<
    Database["public"]["Tables"]["tasks"]["Insert"],
    "task_no"
> & Partial<Pick<Database["public"]["Tables"]["tasks"]["Insert"], "task_no">>;

export enum ClientType {
    SERVER = 'server',
    SPA = 'spa'

}

export class SassClient {
    private client: SupabaseClient<Database, "public", "public">;
    private clientType: ClientType;

    constructor(client: SupabaseClient<Database, "public", "public">, clientType: ClientType) {
        this.client = client;
        this.clientType = clientType;

    }

    async loginEmail(email: string, password: string) {
        return this.client.auth.signInWithPassword({
            email: email,
            password: password
        });
    }

    async registerEmail(email: string, password: string) {
        return this.client.auth.signUp({
            email: email,
            password: password
        });
    }

    async exchangeCodeForSession(code: string) {
        return this.client.auth.exchangeCodeForSession(code);
    }

    async resendVerificationEmail(email: string) {
        return this.client.auth.resend({
            email: email,
            type: 'signup'
        })
    }

    async logout() {
        const { error } = await this.client.auth.signOut({
            scope: 'local',
        });
        if (error) throw error;
        if(this.clientType === ClientType.SPA) {
            window.location.href = '/auth/login';
        }
    }

    async uploadFile(myId: string, filename: string, file: File) {
        filename = filename.replace(/[^0-9a-zA-Z!\-_.*'()]/g, '_');
        filename = myId + "/" + filename
        return this.client.storage.from('files').upload(filename, file);
    }

    async getFiles(myId: string) {
        return this.client.storage.from('files').list(myId)
    }

    async deleteFile(myId: string, filename: string) {
        filename = myId + "/" + filename
        return this.client.storage.from('files').remove([filename])
    }

    async shareFile(myId: string, filename: string, timeInSec: number, forDownload: boolean = false) {
        filename = myId + "/" + filename
        return this.client.storage.from('files').createSignedUrl(filename, timeInSec, {
            download: forDownload
        });

    }

    // --- Profile Methods ---
    async getUserProfile(userId: string) {
        return this.client.from('profiles').select('*').eq('id', userId).maybeSingle();
    }

    async getAllProfiles() {
        return this.client.from('profiles').select('*, user_tasks(count)').order('created_at', { ascending: false });
    }

    async getUserStats() {
        return this.client.from('user_stats_view').select('*').order('created_at', { ascending: false });
    }

    // --- Task Methods (New Schema) ---
    
    // 1. Task Management (Admin)
    async getAdminTasks() {
        return this.client.from('tasks').select('*').order('created_at', { ascending: false });
    }

    async getAdminTasksStats() {
        return this.client.from('admin_tasks_stats_view').select('*');
    }

    async createTask(task: TaskInsertPayload) {
        return this.client.from('tasks').insert(task as Database["public"]["Tables"]["tasks"]["Insert"]).select().single();
    }

    async updateTaskStatus(taskId: string, status: Database["public"]["Tables"]["tasks"]["Row"]["status"]) {
        const response = await fetch('/api/admin/tasks/status', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ taskId, status }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to update task status');
        }

        return data;
    }

    async deleteTask(taskId: string) {
        return this.client.from('tasks').delete().eq('id', taskId);
    }

    // 2. Task Browsing (User)
    // Deprecated: Use getTasksForUser instead for user-facing lists
    async getOpenTasks() {
        return this.client.from('tasks')
            .select('*')
            .eq('status', 'open')
            .order('created_at', { ascending: false });
    }

    async getTasksForUser(userId: string) {
        // Use RPC to get latest 1 task per platform, respecting user permissions
        return this.client.rpc('get_latest_tasks_for_user', {
            p_user_id: userId,
            p_limit_per_platform: 1
        });
    }

    async getTaskDetails(taskId: string) {
        return this.client.from('tasks').select('*').eq('id', taskId).single();
    }

    // 3. Task Assignment (User Joining)
    async joinTask(taskId: string, userId: string) {
        // Use RPC to handle atomic join + status update (bypassing RLS for status update)
        const { data, error } = await this.client.rpc('join_task', { 
            p_task_id: taskId, 
            p_user_id: userId 
        });

        if (error) throw error;
        return { data, error: null };
    }

    async getMyUserTasks(userId: string) {
        // Join with tasks to show task details
        return this.client.from('user_tasks')
            .select('*, tasks(*)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
    }

    async getUserTaskById(userTaskId: string) {
        return this.client.from('user_tasks')
            .select('*, tasks(*)')
            .eq('id', userTaskId)
            .single();
    }

    // 4. Lead Management (Submission & Review)
    async submitLead(lead: Database["public"]["Tables"]["leads"]["Insert"]) {
        return this.client.from('leads').insert(lead).select().single();
    }

    async getLeadsByUserTask(userTaskId: string) {
        return this.client.from('leads')
            .select('*')
            .eq('user_task_id', userTaskId)
            .order('created_at', { ascending: false });
    }

    // Admin: Get all leads for a specific task (to see performance)
    async getLeadsByTask(taskId: string) {
        // Need to join user_tasks to filter by task_id
        return this.client.from('leads')
            .select('*, user_tasks!inner(task_id, user_id, profiles(email, full_name))')
            .eq('user_tasks.task_id', taskId)
            .order('created_at', { ascending: false });
    }
    
    // Admin: Get all pending leads across all tasks
    async getAllPendingLeads() {
        return this.client.from('leads')
            .select('*, user_tasks(proof_urls, tasks(id, title, platform)), profiles(email, full_name)')
            .eq('status', 'pending')
            .order('created_at', { ascending: true });
    }

    async reviewLead(leadId: string, status: string, auditorId: string, note?: string) {
        const updateData: Database["public"]["Tables"]["leads"]["Update"] = {
            status,
            review_note: note,
            auditor_id: auditorId
        };
        
        if (status === 'verified') {
            updateData.verified_at = new Date().toISOString();
        }

        return this.client.from('leads').update(updateData).eq('id', leadId);
    }

    async updateUserTaskProofUrls(userTaskId: string, urls: string[]) {
        return this.client.from('user_tasks').update({ 
            proof_urls: urls,
            link_status: 'pending' // Reset status on new submission
        }).eq('id', userTaskId);
    }

    async adminDeleteUser(userId: string) {
        const response = await fetch(`/api/admin/users?id=${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete user');
        }

        return data;
    }

    async adminUpdateUserProfile(userId: string, data: { full_name?: string | null, remark?: string | null, role?: string | null, custom_role_id?: string | null, visible_platforms?: string[] | null, visible_categories?: string[] | null }) {
        const response = await fetch(`/api/admin/users?id=${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const resData = await response.json();
        if (!response.ok) {
            throw new Error(resData.error || 'Failed to update user profile');
        }
        return resData;
    }

    async adminUpdateUserPassword(userId: string, newPassword: string) {
        const response = await fetch(`/api/admin/users/password?id=${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ newPassword }),
        });

        const resData = await response.json();
        if (!response.ok) {
            throw new Error(resData.error || 'Failed to update user password');
        }
        return resData;
    }

    async adminCreateUser(userData: { email: string, password: string, role: string, custom_role_id?: string | null, full_name?: string | null, remark?: string | null, visible_platforms?: string[], visible_categories?: string[] }) {
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to create user');
        }

        return data;
    }

    async getTodayLeads() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return this.client.from('leads')
            .select('*, user_tasks(tasks(platform))')
            .gte('created_at', today.toISOString())
            .in('status', ['verified', 'claimed', 'done', 'completed']);
    }

    // --- Avatar Library Methods ---
    async getAvatars() {
        const { data: avatars, error } = await this.client.from('avatar_library')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) return { data: null, error };

        // Manual join to avoid PGRST200 if FK is not detected
        const userIds = avatars
            .map(a => a.claimed_by)
            .filter(id => id !== null) as string[];

        if (userIds.length > 0) {
            const { data: profiles } = await this.client.from('profiles')
                .select('id, email, full_name')
                .in('id', userIds);
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const merged = avatars.map((a: any) => {
                const profile = profiles?.find(p => p.id === a.claimed_by);
                return {
                    ...a,
                    profiles: profile || null
                };
            });
            
            return { data: merged, error: null };
        }

        return { data: avatars, error: null };
    }

    async getAvailableAvatars() {
        return this.client.from('avatar_library')
            .select('*')
            .is('claimed_by', null)
            .order('created_at', { ascending: false });
    }

    async claimAvatar(avatarId: string) {
        return this.client.rpc('claim_avatar', { p_avatar_id: avatarId });
    }

    async releaseAvatar(avatarId: string) {
        return this.client.rpc('admin_release_avatar', { p_avatar_id: avatarId });
    }

    async createAvatar(avatar: Database["public"]["Tables"]["avatar_library"]["Insert"]) {
        return this.client.from('avatar_library').insert(avatar).select().single();
    }

    async updateAvatar(id: string, data: Database["public"]["Tables"]["avatar_library"]["Update"]) {
        return this.client.from('avatar_library').update(data).eq('id', id).select().single();
    }

    async deleteAvatar(id: string) {
        return this.client.from('avatar_library').delete().eq('id', id);
    }

    async uploadProofImage(file: Blob | File): Promise<string> {
        const fileName = `proof_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const { data, error } = await this.client.storage.from('files').upload(`proofs/${fileName}`, file);
        if (error) throw error;
        
        const { data: { publicUrl } } = this.client.storage.from('files').getPublicUrl(data.path);
        return publicUrl;
    }

    async updateLeadProofImages(leadId: string, images: string[]) {
        return this.client.from('leads').update({ proof_images: images }).eq('id', leadId);
    }

    async unclaimLead(leadId: string) {
        return this.client.rpc('unclaim_lead', { target_lead_id: leadId });
    }

    async abolishLead(leadId: string, reason: string) {
        return this.client.rpc('abolish_lead', { target_lead_id: leadId, reject_reason: reason });
    }

    async getTaskParticipants(taskId: string) {
        return this.client.from('user_tasks')
            .select('*, profiles(*)')
            .eq('task_id', taskId)
            .order('created_at', { ascending: false });
    }

    async reviewTaskLink(userTaskId: string, status: 'approved' | 'rejected' | 'pending', reason?: string) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = { link_status: status };
        if (status === 'rejected') {
            payload.link_reject_reason = reason;
        }
        return this.client.from('user_tasks').update(payload).eq('id', userTaskId);
    }

    // --- Category Methods ---
    async getCategories() {
        return this.client.from('categories').select('*').order('created_at', { ascending: true });
    }

    async createCategory(name: string, parentId?: string) {
        return this.client.from('categories').insert({ name, parent_id: parentId }).select().single();
    }

    async deleteCategory(id: string) {
        return this.client.from('categories').delete().eq('id', id);
    }

    // --- Platform Configuration Methods ---
    async getPlatforms() {
        return this.client.from('platforms').select('*').order('created_at', { ascending: true });
    }

    async createPlatform(platform: { id: string, name: string, color: string }) {
        return this.client.from('platforms').insert(platform);
    }

    async updatePlatform(id: string, updates: { name?: string, color?: string }) {
        return this.client.from('platforms').update(updates).eq('id', id);
    }

    async deletePlatform(id: string) {
        return this.client.from('platforms').delete().eq('id', id);
    }

    // --- Role Methods ---
    async getRoles() {
        return this.client.from('app_roles').select('*').order('created_at', { ascending: true });
    }

    getSupabaseClient() {
        return this.client;
    }


}
