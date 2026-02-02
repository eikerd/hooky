import React, { useState } from "react";
import { Button } from "@/components/ui/button";

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

// Comprehensive emoji collection organized by category
const EMOJI_CATEGORIES = {
  Smileys: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃"],
  Gestures: ["👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞"],
  Symbols: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "⭐", "✨"],
  Alerts: ["🔥", "💥", "⚡", "⚠️", "❌", "🛑", "✅", "☑️", "✔️", "👍"],
  Activities: ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎳"],
  Nature: ["🌈", "☀️", "🌤️", "⛅", "🌥️", "☁️", "🌦️", "🌧️", "⛈️", "🌩️"],
  Objects: ["💻", "⌨️", "🖱️", "🖨️", "📱", "☎️", "📞", "📟", "📠", "🔌"],
  Travel: ["✈️", "🚀", "🛸", "🚁", "🚂", "🚃", "🚄", "🚅", "🚆", "🚇"],
  Food: ["🍕", "🍔", "🍟", "🌭", "🍿", "🥓", "🥞", "🧈", "🥐", "🥯"],
  Animals: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯"],
  Numbers: ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"],
  Misc: ["🎯", "🎲", "🎪", "🎨", "🎭", "🎬", "🎤", "🎧", "🎼", "🎹"],
};

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<keyof typeof EMOJI_CATEGORIES>("Smileys");

  const handleSelect = (emoji: string) => {
    onChange(emoji);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block">
      {/* Display current emoji */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-center w-10 h-10 rounded border border-border bg-card hover:bg-secondary text-xl transition-colors"
        title="Click to change emoji"
      >
        {value || "😊"}
      </button>

      {/* Emoji picker panel */}
      {isOpen && (
        <div className="absolute top-12 left-0 z-50 w-96 bg-card border border-border rounded-lg shadow-2xl p-3">
          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 mb-3 pb-2 border-b border-border">
            {Object.keys(EMOJI_CATEGORIES).map((category) => (
              <button
                key={category}
                onClick={() =>
                  setSelectedCategory(category as keyof typeof EMOJI_CATEGORIES)
                }
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  selectedCategory === category
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-muted"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="grid grid-cols-10 gap-2">
            {EMOJI_CATEGORIES[selectedCategory].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleSelect(emoji)}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-secondary rounded transition-colors hover:scale-110"
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Close button */}
          <div className="mt-3 pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="w-full text-xs"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
