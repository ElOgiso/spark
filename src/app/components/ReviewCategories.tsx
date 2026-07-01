import { Pencil, Video, Rocket, CheckCircle2, XCircle } from "lucide-react";

type Category =
  | "all"
  | "creative"
  | "production"
  | "publishing"
  | "ai_approved"
  | "completed"
  | "rejected";

interface CategoryItem {
  id: Category;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
}

interface ReviewCategoriesProps {
  categories: CategoryItem[];
  activeCategory: Category;
  onCategoryChange?: (category: Category) => void;
}

export function ReviewCategories({
  categories,
  activeCategory,
  onCategoryChange,
}: ReviewCategoriesProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {categories.map((category) => {
        const Icon = category.icon;
        const isActive = activeCategory === category.id;

        return (
          <button
            key={category.id}
            onClick={() => onCategoryChange?.(category.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg
              transition-all duration-200 whitespace-nowrap
              ${
                isActive
                  ? "bg-accent text-foreground shadow-sm"
                  : "bg-background/50 text-muted-foreground hover:bg-accent/20 hover:text-foreground"
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium">{category.label}</span>
            <span
              className={`
                px-2 py-0.5 rounded-full text-xs font-medium
                ${
                  isActive
                    ? "bg-background/50 text-foreground"
                    : "bg-muted/50 text-muted-foreground"
                }
              `}
            >
              {category.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
