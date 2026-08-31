import { BlogEditorForm } from "@/features/content/BlogEditorForm";

export default async function EditBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BlogEditorForm postId={id} />;
}
