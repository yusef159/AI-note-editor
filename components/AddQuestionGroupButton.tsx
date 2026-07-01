"use client";

interface AddQuestionGroupButtonProps {
  onClick: () => void;
}

export default function AddQuestionGroupButton({
  onClick,
}: AddQuestionGroupButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Add question group"
      title="Add an empty question group — click inside it to paste screenshots"
      className="flex items-center justify-center rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 17h7M17.5 14v7" />
      </svg>
    </button>
  );
}
