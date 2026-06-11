'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { SassClient } from '@/lib/supabase/unified';
import { Database } from '@/lib/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Eye } from 'lucide-react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import NProgress from 'nprogress';

type Avatar = Database['public']['Tables']['avatar_library']['Row'];

export default function AvatarLibraryPage() {
    const [client, setClient] = useState<SassClient | null>(null);
    const [avatars, setAvatars] = useState<Avatar[]>([]);
    const [filteredAvatars, setFilteredAvatars] = useState<Avatar[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();
    const router = useRouter();

    const loadAvatars = useCallback(async (c: SassClient) => {
        setLoading(true);
        try {
            // Only load available (unclaimed) avatars
            const { data, error } = await c.getAvailableAvatars();
            if (error) throw error;
            setAvatars(data || []);
            setFilteredAvatars(data || []);
        } catch (error) {
            console.error(error);
            toast({ title: "加载头像库失败", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        createSPASassClientAuthenticated().then(async (c) => {
            setClient(c);
            loadAvatars(c);
        });
    }, [loadAvatars]);

    useEffect(() => {
        const results = avatars.filter(avatar => 
            avatar.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (avatar.description && avatar.description.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        setFilteredAvatars(results);
    }, [searchTerm, avatars]);

    const navigateToDetail = (id: string) => {
        NProgress.start();
        router.push(`/app/avatars/${id}`);
    };

    if (loading && !client) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-rose-600" /></div>;

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">官方头像资源池</h1>
                    <p className="text-gray-500">挑选您喜欢的头像和人设，领取后即可独家使用。</p>
                </div>
                
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                        placeholder="搜索头像名称..." 
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="relative min-h-[200px]">
                {loading && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-lg transition-opacity duration-200">
                        <Loader2 className="h-8 w-8 animate-spin text-rose-600" />
                    </div>
                )}

                {filteredAvatars.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed">
                        <p className="text-gray-500">当前没有可领取的头像资源</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {filteredAvatars.map((avatar) => (
                            <Card 
                                key={avatar.id} 
                                className="overflow-hidden hover:shadow-lg transition-all duration-300 border-gray-100 group cursor-pointer"
                                onClick={() => navigateToDetail(avatar.id)}
                            >
                                <CardContent className="p-0 aspect-square relative bg-gray-50">
                                    <Image 
                                        src={avatar.avatar_url} 
                                        alt={avatar.name}
                                        fill
                                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <div className="bg-white/90 px-3 py-1.5 rounded-full text-[10px] font-bold text-gray-800 flex items-center gap-1 shadow-sm transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                            <Eye className="h-3 w-3" /> 查看详情
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter className="p-3 flex flex-col items-start gap-1">
                                    <div className="font-semibold text-sm truncate w-full text-gray-800 group-hover:text-rose-600 transition-colors">{avatar.name}</div>
                                    {avatar.description && (
                                        <div className="text-[10px] text-gray-400 truncate w-full">{avatar.description}</div>
                                    )}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
