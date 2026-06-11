'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, MessageSquare } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface ChatBoxProps {
    leadId: string;
    userId: string; // Current user ID
}

type ProfileLabel = Pick<Database['public']['Tables']['profiles']['Row'], 'full_name' | 'role'>;
type LeadComment = Database['public']['Tables']['lead_comments']['Row'];
type LeadRead = Database['public']['Tables']['lead_reads']['Row'];
type LeadCommentWithProfile = LeadComment & {
    profiles: ProfileLabel | null;
};

export default function ChatBox({ leadId, userId }: ChatBoxProps) {
    const [comments, setComments] = useState<LeadCommentWithProfile[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [client, setClient] = useState<SassClient | null>(null);
    const [otherLastRead, setOtherLastRead] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    const updateMyReadStatus = useCallback(async (c: SassClient) => {
        if (!userId || !leadId) return;
        // Only mark as read if the document is actually visible to the user
        if (document.visibilityState !== 'visible') return;

        try {
            await c.getSupabaseClient()
                .from('lead_reads')
                .upsert({ 
                    user_id: userId, 
                    lead_id: leadId, 
                    last_read_at: new Date().toISOString() 
                });
        } catch (e) {
            console.error("Failed to update read status:", e);
        }
    }, [leadId, userId]);

    const loadComments = useCallback(async (c: SassClient) => {
        const { data } = await c.getSupabaseClient()
            .from('lead_comments')
            .select('*, profiles(full_name, role)')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: true });
        
        if (data) setComments(data as unknown as LeadCommentWithProfile[]);
    }, [leadId]);

    const loadOtherReadStatus = useCallback(async (c: SassClient) => {
        const { data } = await c.getSupabaseClient()
            .from('lead_reads')
            .select('last_read_at')
            .eq('lead_id', leadId)
            .neq('user_id', userId)
            .order('last_read_at', { ascending: false })
            .limit(1);
        
        if (data && data.length > 0) {
            setOtherLastRead(data[0].last_read_at);
        }
    }, [leadId, userId]);

    useEffect(() => {
        if (!userId || !leadId) return;

        let activeClient: SassClient | null = null;

        createSPASassClientAuthenticated().then(c => {
            setClient(c);
            activeClient = c;
            loadComments(c);
            loadOtherReadStatus(c);
            updateMyReadStatus(c); 
        });

        // Add visibility change listener (more accurate than focus for "reading")
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && activeClient) {
                updateMyReadStatus(activeClient);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Listen to global realtime event dispatched by RealtimeProvider
        const handleNewMessage = async (e: Event) => {
            const newComment = (e as CustomEvent<LeadComment>).detail;
            if (!newComment || newComment.lead_id !== leadId) return;

            const c = await createSPASassClientAuthenticated();
            const { data } = await c.getSupabaseClient()
                .from('lead_comments')
                .select('*, profiles(full_name, role)')
                .eq('id', newComment.id)
                .single();
            
            if (data) {
                const comment = data as unknown as LeadCommentWithProfile;
                setComments(prev => {
                    if (prev.some(c => c.id === comment.id)) return prev;
                    return [...prev, comment];
                });
                
                // Only mark as read if I am currently looking at the page
                if (String(comment.user_id) !== String(userId) && document.visibilityState === 'visible') {
                    updateMyReadStatus(c);
                }
            } else {
                // Fallback
                setComments(prev => {
                    if (prev.some(c => c.id === newComment.id)) return prev;
                    return [...prev, { ...newComment, profiles: { full_name: '未知用户', role: 'unknown' } }];
                });
                if (String(newComment.user_id) !== String(userId) && document.visibilityState === 'visible') {
                    updateMyReadStatus(c);
                }
            }
        };

        const handleUserRead = (e: Event) => {
            const readInfo = (e as CustomEvent<LeadRead>).detail;
            if (!readInfo) return;
            
            if (readInfo.lead_id === leadId && String(readInfo.user_id) !== String(userId)) {
                setOtherLastRead(readInfo.last_read_at);
            }
        };

        window.addEventListener('new-chat-message', handleNewMessage);
        window.addEventListener('user-read-chat', handleUserRead);
        
        return () => {
            window.removeEventListener('new-chat-message', handleNewMessage);
            window.removeEventListener('user-read-chat', handleUserRead);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [leadId, loadComments, loadOtherReadStatus, updateMyReadStatus, userId]); 

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [comments]);

    const handleSend = async () => {
        if (!newMessage.trim() || !client) return;
        setSending(true);
        const content = newMessage.trim();
        
        try {
            const { data, error } = await client.getSupabaseClient()
                .from('lead_comments')
                .insert({
                    lead_id: leadId,
                    user_id: userId,
                    content: content
                })
                .select('*, profiles(full_name, role)')
                .single();

            if (error) throw error;
            
            if (data) {
                const comment = data as unknown as LeadCommentWithProfile;
                setComments(prev => {
                    if (prev.some(c => c.id === comment.id)) return prev;
                    return [...prev, comment];
                });
                setNewMessage('');
            }
        } catch (error) {
            console.error(error);
            toast({ title: "发送失败", variant: "destructive" });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-3 border-b flex items-center gap-2 bg-gray-50/50">
                <MessageSquare className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">内部沟通</span>
                <span className="text-xs text-gray-400 font-normal ml-1">
                    (添加问题处理情况、跟踪情况等留言，等待管理员回复)
                </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {comments.length === 0 && (
                    <div className="text-center text-xs text-gray-400 py-8">
                        暂无沟通记录，可在此留言
                    </div>
                )}
                {comments.map((comment) => {
                    const isMe = comment.user_id === userId;
                                                    const roleName = comment.profiles?.role === 'admin' || comment.profiles?.role === 'super-admin' ? '管理员' : 
                                                                   comment.profiles?.role === 'auditor' ? '邀约员' : '用户';                    
                    const commentTime = new Date(comment.created_at).getTime();
                    const readTime = otherLastRead ? new Date(otherLastRead).getTime() : 0;
                    
                    // Use a generous buffer for clock skew
                    const isRead = isMe && (readTime > 0) && (readTime >= commentTime - 10000);

                    return (
                        <div key={comment.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                <span className="text-[10px] text-gray-400">
                                    {comment.profiles?.full_name || '未知用户'} ({roleName})
                                </span>
                                <span className="text-[10px] text-gray-300">
                                    {new Date(comment.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                {isMe && (
                                    <span className={`text-[10px] font-medium ${isRead ? 'text-blue-500' : 'text-gray-400'}`}>
                                        {isRead ? '已读' : '未读'}
                                    </span>
                                )}
                            </div>
                            <div className={`px-3 py-2 rounded-lg text-sm max-w-[85%] ${
                                isMe 
                                    ? 'bg-blue-600 text-white rounded-br-none' 
                                    : 'bg-gray-100 text-gray-800 rounded-bl-none'
                            }`}>
                                {comment.content}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="p-3 border-t flex gap-2">
                <Input 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="输入消息..."
                    className="flex-1 h-9 text-sm"
                />
                <Button 
                    size="sm" 
                    className="h-9 px-3 bg-blue-600 hover:bg-blue-700" 
                    onClick={handleSend} 
                    disabled={sending || !newMessage.trim()}
                >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    );
}
