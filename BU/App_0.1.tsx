import React, { useEffect, useState } from "react";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";

type SlotsState = Record<string, string | null>;

function Slot({ id, children }: { id: string; children?: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="w-28 h-28 border-2 border-gray-400 rounded bg-gray-50 flex items-center justify-center"
    >
      {children}
    </div>
  );
}

function Item({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="px-3 py-1 rounded bg-indigo-600 text-white shadow"
    >
      {label}
    </button>
  );
}

export default function App() {
  const STORAGE_KEY = "rpg.inventory.slots";
  const defaultSlots: SlotsState = {
    slot0: "sword",
    slot1: "shield",
    slot2: null,
    slot3: null,
    slot4: "potion",
    slot5: null,
    slot6: null,
    slot7: null
  };

  const [slots, setSlots] = useState<SlotsState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SlotsState) : defaultSlots;
    } catch {
      return defaultSlots;
    }
  });

  // persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  }, [slots]);

  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    setSlots((prev) => {
      const next = { ...prev };
      // remove active from any slot that currently contains it
      for (const k of Object.keys(next)) {
        if (next[k] === activeId) next[k] = null;
      }
      // place it in destination
      next[overId] = activeId;
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <h1 className="text-2xl font-semibold mb-4">RPG Inventory — Local Prototype</h1>
      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-4 gap-4 max-w-xl">
          {Object.entries(slots).map(([slotId, itemId]) => (
            <Slot key={slotId} id={slotId}>
              {itemId && <Item id={itemId} label={itemId} />}
            </Slot>
          ))}
        </div>
      </DndContext>

      <div className="mt-6">
        <button
          className="px-3 py-1 mr-2 bg-green-600 text-white rounded"
          onClick={() => {
            // simple reset
            localStorage.removeItem(STORAGE_KEY);
            window.location.reload();
          }}
        >
          Reset Inventory
        </button>
        <span className="text-sm text-gray-600 ml-2">Drag items between slots. Changes are saved locally.</span>
      </div>
    </div>
  );
}
