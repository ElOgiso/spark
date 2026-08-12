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
  Sparkles,
  Info,
  Check,
  AlertCircle,
} from "lucide-react";

export function MarketerDesktopView() {
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

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
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
    setEditingOffer(null);
    setFormData({
      type: "product",
      title: "",
      url: "",
      priceLabel: "",
      description: "",
      active: true,
      isDefault: offers.length === 0, // default if first offer
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (offer: Offer) => {
    setEditingOffer(offer);
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
    setIsModalOpen(true);
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

    if (editingOffer) {
      updateOffer(editingOffer.id, {
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

    setIsModalOpen(false);
    setEditingOffer(null);
  };

  const getTypeTheme = (type: OfferType) => {
    switch (type) {
      case "link":
        return {
          border: "border-sky-500/20 hover:border-sky-500/40",
          badge: "bg-sky-500/10 text-sky-400 border-sky-500/20",
          icon: LinkIcon,
          label: "Link",
        };
      case "product":
        return {
          border: "border-purple-500/20 hover:border-purple-500/40",
          badge: "bg-purple-500/10 text-purple-300 border-purple-500/20",
          icon: Package,
          label: "Product",
        };
      case "course":
        return {
          border: "border-amber-500/20 hover:border-amber-500/40",
          badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          icon: GraduationCap,
          label: "Course",
        };
    }
  };

  const formatHost = (rawUrl: string) => {
    try {
      const parsed = new URL(rawUrl);
      return parsed.hostname + (parsed.pathname !== "/" ? parsed.pathname.slice(0, 18) : "");
    } catch {
      return rawUrl.replace(/^https?:\/\//i, "").slice(0, 24);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border/80 rounded-2xl p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/25">
              <Tag className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Marketer</h2>
              <p className="text-xs text-muted-foreground">
                Business promotion layer — offers SPARK promotes when generating scripts, captions, and publishing packages.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background font-medium text-xs hover:bg-foreground/90 active:scale-[0.98] transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Offer
        </button>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Active Offers</p>
            <p className="text-lg font-bold text-foreground mt-0.5">
              {activeCount} <span className="text-xs font-normal text-muted-foreground">of {offers.length} configured</span>
            </p>
          </div>
          <span className={`w-2.5 h-2.5 rounded-full ${activeCount > 0 ? "bg-success animate-pulse" : "bg-muted-foreground/30"}`} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between sm:col-span-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Default Broadcast CTA</p>
            <p className="text-sm font-semibold text-foreground truncate mt-0.5">
              {defaultOffer ? (
                <span className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                  <span className="truncate">{defaultOffer.title}</span>
                  {defaultOffer.priceLabel && (
                    <span className="text-[11px] font-mono px-2 py-0.2 rounded bg-accent/15 text-accent shrink-0">
                      {defaultOffer.priceLabel}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground font-normal">None configured — SPARK uses organic engagement CTA</span>
              )}
            </p>
          </div>
          <span className="text-[11px] font-mono uppercase px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/20 text-accent font-semibold shrink-0">
            {defaultOffer ? "Auto-Attached" : "Organic"}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3 overflow-x-auto">
        {(
          [
            { id: "all", label: "All Offers", count: counts.all },
            { id: "link", label: "Links", count: counts.link },
            { id: "product", label: "Products", count: counts.product },
            { id: "course", label: "Courses", count: counts.course },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
              filterType === tab.id
                ? "bg-accent text-accent-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
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

      {/* Offers Card Grid */}
      {filteredOffers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <Tag className="w-6 h-6" />
          </div>
          <div className="max-w-md">
            <h3 className="text-base font-semibold text-foreground">
              {filterType === "all" ? "No offers configured" : `No ${filterType} offers found`}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Add links, digital products, or courses you want SPARK to promote in video captions, call-to-actions, and publishing packages.
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add First Offer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOffers.map((offer) => {
            const theme = getTypeTheme(offer.type);
            const Icon = theme.icon;
            const isDeleting = deleteConfirmId === offer.id;

            return (
              <div
                key={offer.id}
                className={`relative rounded-2xl border bg-card p-5 transition-all flex flex-col justify-between space-y-4 shadow-sm ${theme.border} ${
                  !offer.active ? "opacity-60 bg-muted/20" : ""
                }`}
              >
                {/* Card Top Row */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${theme.badge}`}>
                        <Icon className="w-3 h-3" />
                        {theme.label}
                      </span>
                      {offer.priceLabel && (
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-foreground/5 border border-border text-foreground">
                          {offer.priceLabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {offer.isDefault && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400">
                          <Star className="w-2.5 h-2.5 fill-amber-400" />
                          Default CTA
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

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-base font-semibold text-foreground leading-snug line-clamp-1">
                      {offer.title}
                    </h3>
                    {offer.description ? (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {offer.description}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/40 mt-1 italic">No description provided</p>
                    )}
                  </div>
                </div>

                {/* Card Bottom Row & Actions */}
                <div className="space-y-3 pt-2 border-t border-border/50">
                  {/* Host Link Preview */}
                  <a
                    href={offer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-mono text-accent hover:underline truncate max-w-full"
                    title={offer.url}
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate">{formatHost(offer.url)}</span>
                  </a>

                  {/* Actions Bar */}
                  {isDeleting ? (
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 animate-in fade-in duration-200">
                      <span className="text-[11px] text-destructive font-medium">Confirm remove?</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => removeOffer(offer.id)}
                          className="px-2.5 py-1 rounded bg-destructive text-destructive-foreground text-[11px] font-medium hover:bg-destructive/90"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2 py-1 rounded border border-border text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {!offer.isDefault && offer.active && (
                          <button
                            onClick={() => setDefaultOffer(offer.id)}
                            className="px-2.5 py-1 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
                            title="Set as the default CTA for all generated production briefs"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          onClick={() => toggleOfferActive(offer.id)}
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                            offer.active
                              ? "border-border text-muted-foreground hover:text-foreground"
                              : "border-success/30 text-success hover:bg-success/10"
                          }`}
                        >
                          {offer.active ? "Pause" : "Activate"}
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(offer)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
                          title="Edit offer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(offer.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Remove offer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {editingOffer ? "Edit Offer" : "Add Promotion Offer"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure external product link to promote in video captions and publishing packages.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
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

            {/* Modal Form */}
            <form onSubmit={handleSave} className="space-y-4">
              {/* Type Segmented Control */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Offer Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { type: "product" as OfferType, label: "Product", icon: Package, desc: "Ebook / Asset" },
                      { type: "link" as OfferType, label: "Link", icon: LinkIcon, desc: "Community / Site" },
                      { type: "course" as OfferType, label: "Course", icon: GraduationCap, desc: "Masterclass" },
                    ] as const
                  ).map((t) => {
                    const Icon = t.icon;
                    const isSelected = formData.type === t.type;
                    return (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: t.type })}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "bg-accent/20 border-accent text-accent-foreground shadow-sm"
                            : "border-border bg-background hover:bg-accent/5 text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="w-3.5 h-3.5" />
                          <span className="text-xs font-semibold">{t.label}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Offer Title <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Creator OS Blueprint, Notion Template, Masterclass"
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
                <p className="text-[10px] text-muted-foreground mt-1">
                  Pasted external link (Gumroad, Paystack, Stripe Link, Notion, portfolio, etc.).
                </p>
              </div>

              {/* Price Label */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Price Label <span className="text-muted-foreground/60 font-normal">(optional display)</span>
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
                  Short CTA Description <span className="text-muted-foreground/60 font-normal">(optional)</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief hook or value proposition to attach to captions..."
                  rows={2}
                  className="w-full text-xs bg-background border border-border rounded-xl p-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent resize-none"
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-background cursor-pointer hover:bg-accent/5">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Active Offer</p>
                    <p className="text-[10px] text-muted-foreground">Available for promotions</p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-background cursor-pointer hover:bg-accent/5">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Default CTA</p>
                    <p className="text-[10px] text-muted-foreground">Auto-attached to briefs</p>
                  </div>
                </label>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 active:scale-[0.98] transition-all shadow-sm"
                >
                  {editingOffer ? "Save Changes" : "Create Offer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
