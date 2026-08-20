interface Props {
  text: string
  isStreaming: boolean
  className?: string
}

export default function StreamingText({ text, isStreaming, className = '' }: Props) {
  return (
    <div className={`text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed ${className}`}>
      {text}
      {isStreaming && <span className="cursor-blink" />}
    </div>
  )
}
