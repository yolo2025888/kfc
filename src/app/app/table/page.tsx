import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LegacyTablePage() {
    return (
        <div className="container mx-auto max-w-2xl py-10">
            <Card>
                <CardHeader>
                    <CardTitle>旧表格页面已迁移</CardTitle>
                    <CardDescription>
                        这个页面原来依赖已经移除的 todo_list 示例表。当前业务任务请使用任务大厅或后台任务管理。
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-3">
                    <Button asChild>
                        <Link href="/app/tasks">任务大厅</Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/app/admin/tasks">任务管理</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
