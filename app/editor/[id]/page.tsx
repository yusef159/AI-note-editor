import EditorPage from "@/components/EditorPage";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <EditorPage noteId={id} />;
}
