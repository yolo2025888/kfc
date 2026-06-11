'use client';

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import Image from "next/image";

interface ImageViewerProps {
    src: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ImageViewer({ src, open, onOpenChange }: ImageViewerProps) {
    if (!src) return null;
    
    const isVideo = src.match(/\.(mp4|webm|ogg|mov)$/i);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-transparent border-none shadow-none flex justify-center items-center overflow-hidden">
                <div className="sr-only">
                    <DialogTitle>预览</DialogTitle>
                </div>
                <div className="relative w-[90vw] h-[90vh] flex items-center justify-center pointer-events-none">
                    {/* pointer-events-none on container, auto on content to allow controls interaction */}
                    {isVideo ? (
                        <video 
                            src={src} 
                            controls 
                            autoPlay 
                            className="max-w-full max-h-full pointer-events-auto"
                        />
                    ) : (
                        <Image 
                            src={src} 
                            alt="Preview" 
                            fill 
                            className="object-contain pointer-events-auto" 
                            unoptimized
                            onClick={() => onOpenChange(false)}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
