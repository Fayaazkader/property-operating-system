import Image from "next/image";
import { cn } from "@/lib/utils";

interface ScreenshotFrameProps {
  src: string;
  alt: string;
  className?: string;
}

export default function ScreenshotFrame({
  src,
  alt,
  className,
}: ScreenshotFrameProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border border-white/10 bg-[#0B0B0B] shadow-[0_40px_120px_rgba(0,0,0,0.55)]",
        className
      )}
    >
      <Image
        src={src}
        alt={alt}
        width={1800}
        height={1100}
        className="w-full h-auto object-cover"
        priority
      />
    </div>
  );
}
