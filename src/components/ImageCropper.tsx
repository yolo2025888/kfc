'use client';
/* eslint-disable @next/next/no-img-element -- ReactCrop requires a native img ref. */

import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Crop as CropIcon } from 'lucide-react';
import getCroppedImg from '@/lib/cropUtils';

interface ImageCropperProps {
    src: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCropComplete: (croppedImageBlob: Blob) => void;
}

export default function ImageCropper({ src, open, onOpenChange, onCropComplete }: ImageCropperProps) {
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [loading, setLoading] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // Reset crop when src changes or dialog opens
    useEffect(() => {
        if (!open) {
            setCrop(undefined);
            setCompletedCrop(undefined);
        }
    }, [open]);

    const onImageLoad = () => {
        // Initial crop: center, 90% width, free aspect
        // If we want free aspect, we just set a unit and width/height
        const initialCrop: Crop = {
            unit: '%',
            x: 5,
            y: 5,
            width: 90,
            height: 90
        };
        setCrop(initialCrop);
    };

    const handleSave = async () => {
        if (!src || !completedCrop || !imgRef.current) return;
        
        // If crop is empty or invalid, ignore? 
        // Or if user didn't move it, use the initial crop state if valid?
        // completedCrop should be set if onComplete fired.
        
        setLoading(true);
        try {
            // My getCroppedImg uses src url, but here I have imgRef. 
            // Better to use imgRef to avoid reloading image in util?
            // But my util loads image from URL. Let's stick to util for consistency.
            // But util handles rotation which we don't have here. That's fine.
            
            // Wait, getCroppedImg loads image from URL. 
            // It uses the ORIGINAL image resolution. 
            // completedCrop from ReactCrop is in displayed image pixels if using %, or pixels.
            // If I use imgRef (displayed), I need to scale to natural size if simpler util uses URL.
            
            // Let's modify the usage.
            // ReactCrop returns pixel crop relative to the DISPLAYED image.
            // We need to scale it to NATURAL image size for high quality crop.
            
            const image = imgRef.current;
            const scaleX = image.naturalWidth / image.width;
            const scaleY = image.naturalHeight / image.height;
            
            const actualPixelCrop = {
                x: completedCrop.x * scaleX,
                y: completedCrop.y * scaleY,
                width: completedCrop.width * scaleX,
                height: completedCrop.height * scaleY,
            };

            const croppedImage = await getCroppedImg(src, actualPixelCrop);
            
            if (croppedImage) {
                onCropComplete(croppedImage);
                onOpenChange(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (!src) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>编辑图片</DialogTitle>
                </DialogHeader>
                
                <div className="flex-1 overflow-auto bg-black/5 flex justify-center items-center p-4 min-h-[300px]">
                    <ReactCrop
                        crop={crop}
                        onChange={(_, percentCrop) => setCrop(percentCrop)}
                        onComplete={(c) => setCompletedCrop(c)}
                        className="max-h-[60vh]"
                    >
                        <img
                            ref={imgRef}
                            alt="Crop me"
                            src={src}
                            onLoad={onImageLoad}
                            style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
                        />
                    </ReactCrop>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CropIcon className="mr-2 h-4 w-4" />}
                        保存裁剪
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
