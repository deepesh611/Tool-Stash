interface Props {
  text: string
  isStreaming: boolean
  className?: string
}

export default function StreamingText({ text, isStreaming, className = '' }: Props) {
  return (
    <div
      className={`text-label text-white/65 whitespace-pre-wrap font-mono leading-[1.75] ${className}`}
    >
      {text}
      {isStreaming && <span className="cursor-blink" />}
    </div>
  )
}
