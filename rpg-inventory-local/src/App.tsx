import React, { useEffect, useState } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  pointerWithin,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

type Stats = Record<string, string | number>;
type Item = {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  stats: Stats;
};
type SlotsState = Record<string, string | null>;

const SLOT_IDS = ["head", "body", "mainHand", "offHand", "legs"] as const;
const SLOT_LABELS: Record<(typeof SLOT_IDS)[number], string> = {
  head: "Head",
  body: "Body",
  mainHand: "Main Hand",
  offHand: "Off-Hand",
  legs: "Legs",
};
const isSlotId = (id: string): id is (typeof SLOT_IDS)[number] =>
  (SLOT_IDS as readonly string[]).includes(id);

// ---------------- Tooltip Component ----------------
function HoverTooltip({
  item,
  position,
}: {
  item: Item;
  position: { x: number; y: number };
}) {
  return (
    <div
      className="
        fixed
        z-[99999]             /* sit above absolutely everything */
        bg-[white]              /* solid white background */
        bg-opacity-[100]        /* guarantee 100% opacity */
        border-[2] border-indigo-[500]
        rounded-[lg]
        shadow-[2xl]
        p3[-]
        max-w-[350px]         /* hard cap the width */
        text-sm
        pointer-events-none   /* tooltip itself doesn’t block dragging */
      "
      style={{
        top: position.y + 12,
        left: position.x + 12,
      }}
    >
      <div className="font-bold mb-1 text-indigo-700">
        {item.icon ?? "🎲"} {item.name}
      </div>

      {item.description && <p className="mb-1 break-words">{item.description}</p>}

      {Object.keys(item.stats).length > 0 && (
        <ul className="list-disc ml-4">
          {Object.entries(item.stats).map(([k, v]) => (
            <li key={k}>
              {k}: {v as string | number}
            </li>
          ))}
        </ul>
      )}

      {Object.keys(item.stats).length === 0 && !item.description && (
        <p className="text-gray-500">No description or stats</p>
      )}
    </div>
  );
}



// ---------- Item wrappers with hover tracking ----------
function EquipmentItem({
  item,
  onHover,
}: {
  item: Item;
  onHover: (item: Item | null, e?: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: item.id,
  });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onMouseEnter={(e) => onHover(item, e)}
      onMouseMove={(e) => onHover(item, e)}
      onMouseLeave={() => onHover(null)}
      className="cursor-move p-2 rounded bg-indigo-600 text-white text-center select-none"
    >
      {item.icon ?? "🎲"}
      <br />
      {item.name}
    </div>
  );
}

function StorageItem({
  item,
  onDelete,
  onHover,
}: {
  item: Item;
  onDelete: () => void;
  onHover: (item: Item | null, e?: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
    transition,
  };
  return (
    <div className="mb-2 flex items-center justify-between">
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onMouseEnter={(e) => onHover(item, e)}
        onMouseMove={(e) => onHover(item, e)}
        onMouseLeave={() => onHover(null)}
        className="cursor-move p-2 rounded bg-indigo-600 text-white text-center select-none"
      >
        {item.icon ?? "🎲"}
        <br />
        {item.name}
      </div>
      <button
        onClick={onDelete}
        className="text-sm text-red-600 hover:underline ml-3"
      >
        Delete
      </button>
    </div>
  );
}

function EquipmentSlot({
  id,
  label,
  children,
}: {
  id: (typeof SLOT_IDS)[number];
  label: string;
  children?: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div className="flex flex-col items-center">
      <div
        ref={setNodeRef}
        className="w-[80px] h-[80px] border-2 border-gray-400 rounded bg-gray-50 flex items-center justify-center"
      >
        {children}
      </div>
      <div className="mt-1 text-sm font-medium">{label}</div>
    </div>
  );
}

function StorageContainer({ children }: { children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: "storage" });
  return (
    <div
      ref={setNodeRef}
      className="border-2 border-dashed rounded p-4 bg-white max-w-lg min-h-[120px] flex flex-col"
    >
      {children}
    </div>
  );
}

// ---------------- Main App ----------------
export default function App() {
  const LS_KEY = "rpg.inventory.tooltip-hover";

  const [items, setItems] = useState<Item[]>([]);
  const [storageOrder, setStorageOrder] = useState<string[]>([]);
  const [slots, setSlots] = useState<SlotsState>({
    head: null,
    body: null,
    mainHand: null,
    offHand: null,
    legs: null,
  });

  // New item form
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStats, setNewStats] = useState("");

  // Tooltip state
  const [hoverItem, setHoverItem] = useState<Item | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  // Load & Save
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setItems(parsed.items ?? []);
        setStorageOrder(parsed.storageOrder ?? []);
        setSlots((prev) => ({ ...prev, ...(parsed.slots ?? {}) }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ items, storageOrder, slots })
    );
  }, [items, storageOrder, slots]);

  // Add/Delete
  function addItem() {
    if (!newName.trim()) return;
    const stats: Stats = {};
    newStats.split(",").forEach((pair) => {
      const [k, v] = pair.split("=").map((s) => s.trim());
      if (k) stats[k] = isNaN(Number(v)) ? v : Number(v);
    });
    const id = crypto.randomUUID();
    const newItem: Item = {
      id,
      name: newName.trim(),
      icon: newIcon || undefined,
      description: newDesc || "",
      stats,
    };
    setItems((prev) => [...prev, newItem]);
    setStorageOrder((prev) => [...prev, id]);
    setNewName("");
    setNewIcon("");
    setNewDesc("");
    setNewStats("");
  }

  function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setStorageOrder((prev) => prev.filter((x) => x !== id));
    setSlots((prev) => {
      const next = { ...prev };
      for (const k of SLOT_IDS) if (next[k] === id) next[k] = null;
      return next;
    });
  }

  // Drag & Drop
  function unequip(itemId: string) {
    setSlots((prev) => {
      const next = { ...prev };
      for (const k of SLOT_IDS) if (next[k] === itemId) next[k] = null;
      return next;
    });
  }

  function handleDragEnd(event: any) {
    const activeId = event?.active?.id as string;
    const overId = event?.over?.id as string;
    if (!activeId || !overId) return;

    const inStorageActive = storageOrder.includes(activeId);
    const inStorageOver = storageOrder.includes(overId);

    if (inStorageActive && inStorageOver) {
      const oldIndex = storageOrder.indexOf(activeId);
      const newIndex = storageOrder.indexOf(overId);
      if (oldIndex !== newIndex) {
        setStorageOrder((prev) => arrayMove(prev, oldIndex, newIndex));
      }
      return;
    }

    if (overId === "storage") {
      unequip(activeId);
      if (!inStorageActive) setStorageOrder((prev) => [...prev, activeId]);
      return;
    }

    if (isSlotId(overId)) {
      setSlots((prev) => {
        const next = { ...prev };
        const replaced = next[overId];
        if (replaced && !storageOrder.includes(replaced)) {
          setStorageOrder((prev) => [...prev, replaced]);
        }
        for (const k of SLOT_IDS) if (next[k] === activeId) next[k] = null;
        next[overId] = activeId;
        return next;
      });
      if (inStorageActive) {
        setStorageOrder((prev) => prev.filter((x) => x !== activeId));
      }
    }
  }

  // Tooltip handlers
  function handleHover(item: Item | null, e?: React.MouseEvent) {
    setHoverItem(item);
    if (e) setTooltipPos({ x: e.clientX, y: e.clientY });
  }

  const storageItems = storageOrder
    .map((id) => items.find((i) => i.id === id))
    .filter(Boolean) as Item[];

  return (
    <div className="min-h-screen bg-slate-100 p-6 relative">
      <h1 className="text-2xl font-semibold mb-4">RPG Equipment + Storage</h1>

      {/* Add Item */}
      <div className="flex flex-col gap-2 mb-6 max-w-lg">
        <div className="flex gap-2">
          <input
            className="border p-2 rounded flex-1"
            placeholder="Item name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="border p-2 rounded w-24"
            placeholder="Icon (emoji)"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
          />
        </div>
        <textarea
          className="border p-2 rounded"
          placeholder="Description"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
        />
        <input
          className="border p-2 rounded"
          placeholder="Stats (e.g. attack=5, defense=2)"
          value={newStats}
          onChange={(e) => setNewStats(e.target.value)}
        />
        <button
          onClick={addItem}
          className="bg-green-600 text-white px-4 py-2 rounded self-start"
        >
          Add Item
        </button>
      </div>

      <DndContext collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
        {/* Equipment */}
        <div className="flex flex-col items-center gap-4 mb-12">
          <EquipmentSlot id="head" label={SLOT_LABELS.head}>
            {slots.head && (
              <EquipmentItem
                item={items.find((i) => i.id === slots.head)!}
                onHover={handleHover}
              />
            )}
          </EquipmentSlot>

          <div className="flex items-center gap-8">
            <EquipmentSlot id="mainHand" label={SLOT_LABELS.mainHand}>
              {slots.mainHand && (
                <EquipmentItem
                  item={items.find((i) => i.id === slots.mainHand)!}
                  onHover={handleHover}
                />
              )}
            </EquipmentSlot>

            <EquipmentSlot id="body" label={SLOT_LABELS.body}>
              {slots.body && (
                <EquipmentItem
                  item={items.find((i) => i.id === slots.body)!}
                  onHover={handleHover}
                />
              )}
            </EquipmentSlot>

            <EquipmentSlot id="offHand" label={SLOT_LABELS.offHand}>
              {slots.offHand && (
                <EquipmentItem
                  item={items.find((i) => i.id === slots.offHand)!}
                  onHover={handleHover}
                />
              )}
            </EquipmentSlot>
          </div>

          <EquipmentSlot id="legs" label={SLOT_LABELS.legs}>
            {slots.legs && (
              <EquipmentItem
                item={items.find((i) => i.id === slots.legs)!}
                onHover={handleHover}
              />
            )}
          </EquipmentSlot>
        </div>

        {/* Storage */}
        <h2 className="text-xl font-semibold mb-2">Storage</h2>
        <StorageContainer>
          <SortableContext
            items={storageOrder}
            strategy={verticalListSortingStrategy}
          >
            {storageItems.map((item) => (
              <StorageItem
                key={item.id}
                item={item}
                onDelete={() => deleteItem(item.id)}
                onHover={handleHover}
              />
            ))}
          </SortableContext>
          {storageItems.length === 0 && (
            <p className="text-gray-500 text-sm">Storage is empty. Drag items here.</p>
          )}
        </StorageContainer>
      </DndContext>

      {hoverItem && <HoverTooltip item={hoverItem} position={tooltipPos} />}
    </div>
  );
}
