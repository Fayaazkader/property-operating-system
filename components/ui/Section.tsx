import Container from "./Container";
import { cn } from "@/lib/utils";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export default function Section({
  children,
  className,
  id,
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative py-28 lg:py-40",
        className
      )}
    >
      <Container>
        {children}
      </Container>
    </section>
  );
}
