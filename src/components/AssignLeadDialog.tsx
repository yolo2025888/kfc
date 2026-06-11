import React, { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Search, UserCheck, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SassClient } from '@/lib/supabase/unified';
import { useToast } from "@/hooks/use-toast";
import { cn, getErrorMessage } from '@/lib/utils';
import Image from 'next/image';

interface AssignLeadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    leadId: string;
    client: SassClient | null;
    onSuccess: () => void;
}

interface Auditor {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
}

export function AssignLeadDialog({ open, onOpenChange, leadId, client, onSuccess }: AssignLeadDialogProps) {
    const [auditors, setAuditors] = useState<Auditor[]>([]);
    const [filteredAuditors, setFilteredAuditors] = useState<Auditor[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [selectedAuditorId, setSelectedAuditorId] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchAuditors = useCallback(async () => {
        if (!client) return;
        setLoading(true);
        try {
            const { data, error } = await client.getSupabaseClient()
                .from('profiles')
                .select('id, full_name, email, avatar_url')
                .eq('role', 'auditor')
                .order('full_name');
            
            if (error) throw error;
            setAuditors(data || []);
            setFilteredAuditors(data || []);
        } catch (error) {
            console.error('Error fetching auditors:', error);
            toast({ title: "加载审核员失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [client, toast]);

    useEffect(() => {
        if (open && client) {
            fetchAuditors();
        }
    }, [open, client, fetchAuditors]);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredAuditors(auditors);
        } else {
            const lowerQuery = searchQuery.toLowerCase();
            setFilteredAuditors(auditors.filter(a => 
                (a.full_name?.toLowerCase().includes(lowerQuery)) || 
                (a.email?.toLowerCase().includes(lowerQuery))
            ));
        }
    }, [searchQuery, auditors]);

    const handleAssign = async () => {
        if (!client || !selectedAuditorId) return;
        setAssigning(true);
        try {
            const { error } = await client.getSupabaseClient()
                .rpc('admin_assign_lead', {
                    target_lead_id: leadId,
                    target_auditor_id: selectedAuditorId
                });
            
            if (error) throw error;
            
            toast({ title: "分配成功", description: "客资已成功分配给选定审核员" });
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error('Error assigning lead:', error);
            toast({ title: "分配失败", description: getErrorMessage(error), variant: "destructive" });
        } finally {
            setAssigning(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>分配客资给审核员</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-2">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="搜索审核员..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8"
                        />
                    </div>

                    <div className="h-[300px] border rounded-md p-2 overflow-y-auto custom-scrollbar">
                        {loading ? (
                            <div className="flex justify-center items-center h-full">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredAuditors.length === 0 ? (
                            <div className="text-center text-sm text-muted-foreground py-8">
                                未找到审核员
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {filteredAuditors.map((auditor) => (
                                    <div
                                        key={auditor.id}
                                        onClick={() => setSelectedAuditorId(auditor.id)}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                                            selectedAuditorId === auditor.id 
                                                ? "bg-blue-50 border border-blue-200" 
                                                : "hover:bg-gray-50 border border-transparent"
                                        )}
                                    >
                                        <div className="relative h-10 w-10 rounded-full border border-gray-200 flex-shrink-0 overflow-hidden bg-gray-100 flex items-center justify-center">
                                            {auditor.avatar_url ? (
                                                <Image src={auditor.avatar_url} alt="" fill unoptimized sizes="40px" className="object-cover" />
                                            ) : (
                                                <span className="text-gray-400 text-sm font-bold">
                                                    {auditor.full_name?.[0] || 'A'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="font-medium text-sm truncate">{auditor.full_name || '未命名'}</div>
                                            <div className="text-xs text-muted-foreground truncate">{auditor.email}</div>
                                        </div>
                                        {selectedAuditorId === auditor.id && (
                                            <UserCheck className="h-5 w-5 text-blue-600" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                    <Button 
                        onClick={handleAssign} 
                        disabled={!selectedAuditorId || assigning}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {assigning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        确认分配
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
