import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export interface SearchableSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[] | string[];
  placeholder?: string;
  allowCustom?: boolean;
  className?: string;
}

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  allowCustom = false,
  className = "",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [isCustomMode, setIsCustomMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCustomMode(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const isCurrentValueInList = options.includes(value as any);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch("");
    setIsCustomMode(false);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onChange(customInput.trim());
      setCustomInput("");
      setIsCustomMode(false);
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border border-border bg-background hover:bg-accent/10 focus:outline-none focus:border-accent text-left transition-colors cursor-pointer"
      >
        <span className={`truncate ${value ? "text-foreground font-medium" : "text-muted-foreground"}`}>
          {value || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[240px] max-h-[300px] rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2 border-b border-border/60 flex items-center gap-2 bg-muted/20">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto max-h-[220px] p-1 divide-y divide-border/20">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = value === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-accent/20 text-accent-foreground font-medium"
                        : "text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span className="truncate">{opt}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-2" />}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-center text-xs text-muted-foreground">
                No matching options
              </div>
            )}

            {/* Custom Input Option */}
            {allowCustom && (
              <div className="p-1 pt-1.5 border-t border-border/50">
                {!isCustomMode ? (
                  <button
                    type="button"
                    onClick={() => setIsCustomMode(true)}
                    className="w-full text-left px-3 py-1.5 text-xs text-accent font-medium hover:bg-accent/10 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <span>+ Custom {label || "Option"}...</span>
                  </button>
                ) : (
                  <form onSubmit={handleCustomSubmit} className="flex gap-1 p-1">
                    <input
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder={`Enter custom ${label?.toLowerCase() || "value"}...`}
                      className="flex-1 bg-background text-xs text-foreground border border-accent/50 rounded px-2 py-1 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-2 py-1 bg-accent text-accent-foreground text-xs rounded font-medium hover:bg-accent/90 cursor-pointer"
                    >
                      Set
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
