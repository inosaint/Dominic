// Annotation writing logic for Figma

import { ReviewItem } from './types';

export async function getOrCreateAIReviewCategory(): Promise<string> {
  const categories = await figma.annotations.getAnnotationCategoriesAsync();

  const existing = categories.find((c) => c.label === 'AI Review');
  if (existing) return existing.id;

  const newCategory = await figma.annotations.addAnnotationCategoryAsync({
    label: 'AI Review',
    color: 'violet',
  });

  return newCategory.id;
}

function applyAnnotation(
  node: SceneNode & { annotations: Annotation[] },
  item: ReviewItem,
  categoryId: string
): void {
  const severityIcon: Record<string, string> = {
    suggestion: '\u{1F4A1}',
    warning: '\u26A0\uFE0F',
    issue: '\u{1F534}',
  };

  const icon = severityIcon[item.severity] || '\u{1F4A1}';
  const markdown = `${icon} **${item.category}**\n\n${item.feedback}`;

  const existing = [...node.annotations];
  existing.push({
    labelMarkdown: markdown,
    categoryId: categoryId,
  } as Annotation);
  node.annotations = existing;
}

export async function writeAnnotations(
  reviewItems: ReviewItem[],
  categoryId: string
): Promise<{ written: number; skipped: number }> {
  let written = 0;
  let skipped = 0;

  for (const item of reviewItems) {
    const node = await figma.getNodeByIdAsync(item.nodeId);

    if (!node || !('annotations' in node)) {
      // Fall back to the selected frame
      const fallbackNode = figma.currentPage.selection[0];
      if (fallbackNode && 'annotations' in fallbackNode) {
        applyAnnotation(
          fallbackNode as SceneNode & { annotations: Annotation[] },
          item,
          categoryId
        );
        written++;
      } else {
        skipped++;
      }
      continue;
    }

    applyAnnotation(
      node as SceneNode & { annotations: Annotation[] },
      item,
      categoryId
    );
    written++;
  }

  return { written, skipped };
}

export async function clearAIAnnotations(
  rootNode: SceneNode,
  categoryId: string
): Promise<void> {
  async function clearNode(node: SceneNode) {
    if ('annotations' in node) {
      const annotations = (node as any).annotations as Annotation[];
      const filtered = annotations.filter((a) => a.categoryId !== categoryId);
      if (filtered.length !== annotations.length) {
        (node as any).annotations = filtered;
      }
    }

    if ('children' in node) {
      const children = (node as ChildrenMixin).children as readonly SceneNode[];
      for (const child of children) {
        await clearNode(child);
      }
    }
  }

  await clearNode(rootNode);
}
