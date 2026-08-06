interface ErrorMessageProps {
  message: string
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{message}</p>
}
