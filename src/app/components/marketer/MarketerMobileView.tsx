import React, { useState, useMemo } from "react";
import { useSpark } from "../../state/SparkContext";
import type { Offer, OfferType } from "../../domain/types";
import {
  Tag,
  Plus,
  Link as LinkIcon,
  Package,
  GraduationCap,
  ExternalLink,
  Edit3,
  Trash2,
  CheckCircle2,
  Star,
  X,
  ArrowLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

interface MarketerMobileViewProps {
  onBack?: () => void;
}

export function MarketerMobileView({ onBack }: MarketerMobileViewProps) {
  const {
    offers = [],
    addOffer,
    updateOffer,
    removeOffer,
    setDefaultOffer,
    toggleOfferActive,
  } = useSpark();

  // Filter state
  const [filterType, setFilterType] = useState<"all" | OfferType>("all");

  // Bottom sheet states
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState<{
    type: OfferType;
    title: string;
    url: string;
    priceLabel: string;
    description: string;
    active: boolean;
    isDefault: boolean;
  }>({
    type: "product",
    title: "",
    url: "",
    priceLabel: "",
    description: "",
    active: true,
    isDefault: false,
  });

  const [formError, setFormError] = useState<string | null>(null);

  const activeCount = offers.filter((o) => o.active).length;
  const defaultOffer = offers.find((o) => o.active && o.isDefault) || offers.find((o) => o.isDefault);

  const filteredOffers = useMemo(() => {
    if (filterType === "all") return offers;
    return offers.filter((o) => o.type === filterType);
  }, [offers, filterType]);

  const counts = {
    all: offers.length,
    link: offers.filter((o) => o.type === "link").length,
    product: offers.filter((o) => o.type === "product").length,
    course: offers.filter((o) => o.type === "course").length,
  };

  const handleOpenAdd = () => {
    setSelectedOffer(null);
    setIsEditOpen(false);
    setFormData({
      type: "product",
      title: "",
      url: "",
      priceLabel: "",
      description: "",
      active: true,
      isDefault: offers.length === 0,
    });
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (offer: Offer) => {
    setSelectedOffer(offer);
    setFormData({
      type: offer.type,
      title: offer.title,
      url: offer.url,
      priceLabel: offer.priceLabel || "",
      description: offer.description || "",
      active: offer.active,
      isDefault: Boolean(offer.isDefault),
    });
    setFormError(null);
    setIsAddOpen(false);
    setIsEditOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    const cleanUrl = formData.url.trim();
    if (!cleanUrl) {
      setFormError("URL is required.");
      return;
    }
    if (!/^https?:\/\//i.test(cleanUrl)) {
      setFormError("URL must begin with http:// or https://");
      return;
    }

    if (isEditOpen && selectedOffer) {
      updateOffer(selectedOffer.id, {
        type: formData.type,
        title: formData.title.trim(),
        url: cleanUrl,
        priceLabel: formData.priceLabel.trim() || undefined,
        description: formData.description.trim() || undefined,
        active: formData.active,
        isDefault: formData.isDefault,
      });
    } else {
      addOffer({
        type: formData.type,
        title: formData.title.trim(),
        url: cleanUrl,
        priceLabel: formData.priceLabel.trim() || undefined,
        description: formData.description.trim() || undefined,
        active: formData.active,
        isDefault: formData.isDefault,
      });
    }

    setIsAddOpen(false);
    setIsEditOpen(false);
    setSelectedOffer(null);
  };

  const getTypeTheme = (type: OfferType) => {
    switch (type) {
      case "link":
        return {
          border: "border-sky-500/25",
          badge: "bg-sky-500/15 text-sky-400 border-sky-500/30",
          icon: LinkIcon,
          label: "Link",
        };
      case "product":
        return {
          border: "border-purple-500/25",
          badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
          icon: Package,
          label: "Product",
        };
      case "course":
        return {
          border: "border-amber-500/25",
          badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
          icon: GraduationCap,
          label: "Course",
        };
    }
  };

  const formatHost = (rawUrl: string) => {
    try {
      const parsed = new URL(rawUrl);
      return parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname.slice(0, 16) : "");
    } catch {
      return rawUrl.replace(/^https?:\/\//i, "").slice(0, 20);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-36">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground active:text-foreground active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-none">Marketer</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Promotion Layer</p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold active:scale-95 transition-transform shadow-md"
          title="Add Offer"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* Helper Card */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-foreground">Content Promotion Desk</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Offers SPARK can promote when generating scripts, captions, and publishing packages.
              </p>
            </div>
            <span className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/25 shrink-0">
              <Tag className="w-4 h-4" />
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50">
            <div className="p-2 rounded-lg bg-background border border-border">
              <p className="text-[10px] text-muted-foreground">Active Offers</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{activeCount} / {offers.length}</p>
            </div>
            <div className="p-2 rounded-lg bg-background border border-border min-w-0">
              <p className="text-[10px] text-muted-foreground">Default CTA</p>
              <p className="text-xs font-semibold text-foreground truncate mt-0.5">
                {defaultOffer ? defaultOffer.title : "None (Organic)"}
              </p>
            </div>
          </div>
        </div>

        {/* Large Add Offer Button */}
        <button
          onClick={handleOpenAdd}
          className="w-full py-3 px-4 rounded-xl bg-foreground text-background font-semibold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add New Offer
        </button>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {(
            [
              { id: "all", label: "All", count: counts.all },
              { id: "link", label: "Links", count: counts.link },
              { id: "product", label: "Products", count: counts.product },
              { id: "course", label: "Courses", count: counts.course },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                filterType === tab.id
                  ? "bg-accent text-accent-foreground font-semibold shadow-sm"
                  : "bg-card border border-border text-muted-foreground"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                filterType === tab.id ? "bg-accent-foreground/20 text-accent-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Offer Cards List */}
        {filteredOffers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center flex flex-col items-center justify-center space-y-3 mt-4">
            <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <Tag className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {filterType === "all" ? "No offers yet" : `No ${filterType} offers`}
            </p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Add links to Gumroad, Paystack, Stripe, or your site to promote in videos.
            </p>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 rounded-xl bg-foreground text-background text-xs font-medium active:scale-95 transition-transform"
            >
              + Add Offer
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOffers.map((offer) => {
              const theme = getTypeTheme(offer.type);
              const Icon = theme.icon;

              return (
                <div
                  key={offer.id}
                  onClick={() => handleOpenEdit(offer)}
                  className={`w-full rounded-2xl border bg-card p-4 text-left transition-all active:scale-[0.98] cursor-pointer space-y-3 shadow-sm ${theme.border} ${
                    !offer.active ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${theme.badge}`}>
                        <Icon className="w-3 h-3" />
                        {theme.label}
                      </span>
                      {offer.priceLabel && (
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-background border border-border text-foreground">
                          {offer.priceLabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {offer.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400">
                          <Star className="w-2.5 h-2.5 fill-amber-400" />
                          Default
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          offer.active
                            ? "bg-success/15 text-success border border-success/30"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                      >
                        {offer.active ? "Active" : "Paused"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-1">
                      {offer.title}
                    </h3>
                    {offer.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                        {offer.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                    <span className="font-mono text-muted-foreground truncate max-w-[200px]">
                      {formatHost(offer.url)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Native Bottom Sheet */}
      {(isAddOpen || isEditOpen) && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full bg-card border-t border-border rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 pb-10">
            {/* Sheet Handle */}
            <div className="w-10 h-1 bg-border rounded-full mx-auto" />

            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <h3 className="text-base font-bold text-foreground">
                {isEditOpen ? "Edit Offer" : "Add Offer"}
              </h3>
              <button
                onClick={() => {
                  setIsAddOpen(false);
                  setIsEditOpen(false);
                  setSelectedOffer(null);
                }}
                className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-muted-foreground active:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {/* Type Segmented Control */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Offer Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { type: "product" as OfferType, label: "Product", icon: Package },
                      { type: "link" as OfferType, label: "Link", icon: LinkIcon },
                      { type: "course" as OfferType, label: "Course", icon: GraduationCap },
                    ] as const
                  ).map((t) => {
                    const Icon = t.icon;
                    const isSelected = formData.type === t.type;
                    return (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: t.type })}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? "bg-accent/20 border-accent text-accent-foreground font-semibold"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        <Icon className="w-4 h-4 mx-auto mb-1" />
                        <span className="text-xs">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Title <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Creator OS Blueprint"
                  className="w-full text-sm bg-background border border-border rounded-xl px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent"
                  required
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Destination URL <span className="text-destructive">*</span>
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://gumroad.com/l/... or https://paystack.shop/..."
                  className="w-full text-sm font-mono bg-background border border-border rounded-xl px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent"
                  required
                />
              </div>

              {/* Price Label */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Price Label (Optional)
                </label>
                <input
                  type="text"
                  value={formData.priceLabel}
                  onChange={(e) => setFormData({ ...formData, priceLabel: e.target.value })}
                  placeholder="e.g. ₦15,000 or $49 or Free"
                  className="w-full text-sm bg-background border border-border rounded-xl px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Short Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief hook or CTA message..."
                  rows={2}
                  className="w-full text-xs bg-background border border-border rounded-xl p-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent resize-none"
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="flex items-center gap-2 p-3 rounded-xl border border-border bg-background cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Active</p>
                    <p className="text-[10px] text-muted-foreground">Live offer</p>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-border bg-background cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Default CTA</p>
                    <p className="text-[10px] text-muted-foreground">Auto-attach</p>
                  </div>
                </label>
              </div>

              {/* Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-foreground text-background font-semibold text-sm active:scale-[0.98] transition-transform shadow-md"
                >
                  {isEditOpen ? "Save Changes" : "Create Offer"}
                </button>

                {isEditOpen && selectedOffer && (
                  <button
                    type="button"
                    onClick={() => {
                      removeOffer(selectedOffer.id);
                      setIsEditOpen(false);
                      setSelectedOffer(null);
                    }}
                    className="w-full py-2.5 rounded-xl border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/10 active:scale-[0.98] transition-transform"
                  >
                    Delete Offer
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
