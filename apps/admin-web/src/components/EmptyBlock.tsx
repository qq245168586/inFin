export interface EmptyBlockProps {
  title: string;
  copy: string;
}

export default function EmptyBlock({ title, copy }: EmptyBlockProps) {
  return (
    <div className="empty-block">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}
