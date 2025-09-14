import React, { useEffect, useState } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  pointerWithin,   // prefer the pointer location for choosing drop target
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

// ---------------- Types ----------------
type Item = {
  id: string;
  name: string;
  icon?: string;
  stats: Record<string, string | number>;
};
type SlotsState = Record<string, string | null>;

// ---------------- Helpers ----------------
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

// ---------------- UI Components ----------------
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
        className="w-32 h-32 border-2 border-gray-400 rounded bg-gray-50 flex items-center justify-center"
      >
        {children}
      </div>
      <div className="mt-1 text-sm font-medium">{label}</div>
    </div>
  );
}

// Draggable used for EQUIPPED items (not in SortableContext)
function EquipmentItem({ item }: { item: Item }) {
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
      className="cursor-move p-2 rounded bg-indigo-600 text-white text-center select-none"
    >
      {item.icon ?? "🎲"}
      <br />
      {item.name}
    </div>
  );
}

// Sortable + draggable used for STORAGE items (inside SortableContext)
function StorageItem({ item, onDelete }: { item: Item; onDelete: () => void }) {
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

// Storage container is an EXPLICIT droppable target with id="storage"
function StorageContainer({
  children,
}: {
  children: React.ReactNode;
}) {
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
  const LS_KEY = "rpg.inventory.storage-fixed";

  const [items, setItems] = useState<Item[]>([]);
  const [storageOrder, setStorageOrder] = useState<string[]>([]);
  const [slots, setSlots] = useState<SlotsState>({
    head: null,
    body: null,
    mainHand: null,
    offHand: null,
    legs: null,
  });

  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");

  // Load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setItems(parsed.items ?? []);
        setStorageOrder(parsed.storageOrder ?? []);
        setSlots((prev) => ({ ...prev, ...(parsed.slots ?? {}) }));
      } else {
        // optional demo items
        const demo: Item[] = [
          { id: "sword", name: "Sword", icon: "🗡️", stats: { attack: 5 } },
          { id: "shield", name: "Shield", icon: "🛡️", stats: { defense: 3 } },
        ];
        setItems(demo);
        setStorageOrder(demo.map((i) => i.id));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Save
  useEffect(() => {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({ items, storageOrder, slots })
    );
  }, [items, storageOrder, slots]);

  // ----- CRUD -----
  function addItem() {
    if (!newName.trim()) return;
    const id = crypto.randomUUID();
    const newItem: Item = {
      id,
      name: newName.trim(),
      icon: newIcon || undefined,
      stats: {},
    };
    setItems((prev) => [...prev, newItem]);
    setStorageOrder((prev) => [...prev, id]); // new items go to storage
    setNewName("");
    setNewIcon("");
  }

  function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setStorageOrder((prev) => prev.filter((x) => x !== id));
    // unequip if equipped
    setSlots((prev) => {
      const next = { ...prev };
      for (const k of SLOT_IDS) if (next[k] === id) next[k] = null;
      return next;
    });
  }

  // ----- Drag & Drop -----
  function unequipEverywhere(itemId: string) {
    setSlots((prev) => {
      const next = { ...prev };
      for (const k of SLOT_IDS) if (next[k] === itemId) next[k] = null;
      return next;
    });
  }

  function moveToStorageAtIndex(itemId: string, toIndex: number) {
    setStorageOrder((prev) => {
      const without = prev.filter((x) => x !== itemId);
      const clamped = Math.max(0, Math.min(toIndex, without.length));
      return [...without.slice(0, clamped), itemId, ...without.slice(clamped)];
    });
  }

  function handleDragEnd(event: any) {
    const activeId = event?.active?.id as string | undefined;
    const overId = event?.over?.id as string | undefined;
    if (!activeId || !overId) return;

    // 1) Reorder inside storage (active and over are both storage items)
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

    // 2) Dropped onto the storage CONTAINER (anywhere inside the box)
    if (overId === "storage") {
      unequipEverywhere(activeId);
      // If it was already in storage, keep order; if not, append to end
      if (!inStorageActive) {
        setStorageOrder((prev) => [...prev, activeId]);
      }
      return;
    }

    // 3) Dropped onto a specific storage ITEM (insert at that position)
    if (inStorageOver) {
      const newIndex = storageOrder.indexOf(overId);
      unequipEverywhere(activeId);
      moveToStorageAtIndex(activeId, newIndex);
      return;
    }

    // 4) Dropped onto an EQUIPMENT SLOT
    if (isSlotId(overId)) {
      const targetSlot = overId;

      setSlots((prev) => {
        const next = { ...prev };
        // if the slot had an item, push that item back to storage (end)
        const replaced = next[targetSlot];
        if (replaced && !storageOrder.includes(replaced)) {
          setStorageOrder((prevOrder) => [...prevOrder, replaced]);
        }
        // remove active from any slot first
        for (const k of SLOT_IDS) if (next[k] === activeId) next[k] = null;
        // equip
        next[targetSlot] = activeId;
        return next;
      });

      // remove equipped item from storage if it was there
      if (inStorageActive) {
        setStorageOrder((prev) => prev.filter((x) => x !== activeId));
      }
      return;
    }

    // otherwise: no-op
  }

  // Items currently in storage (in visual order)
  const storageItems = storageOrder
    .map((id) => items.find((i) => i.id === id))
    .filter(Boolean) as Item[];

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <h1 className="text-2xl font-semibold mb-4">RPG Equipment + Storage</h1>

      {/* Add Item */}
      <div className="flex gap-2 mb-6">
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
        <button
          onClick={addItem}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Add Item
        </button>
      </div>

      <DndContext
        collisionDetection={pointerWithin} // prefer what the pointer is directly over
        onDragEnd={handleDragEnd}
      >
        {/* Equipment Window */}
        <div className="flex flex-col items-center gap-4 mb-12">
          <EquipmentSlot id="head" label={SLOT_LABELS.head}>
            {slots.head && (
              <EquipmentItem item={items.find((i) => i.id === slots.head)!} />
            )}
          </EquipmentSlot>

          <div className="flex items-center gap-8">
            <EquipmentSlot id="mainHand" label={SLOT_LABELS.mainHand}>
              {slots.mainHand && (
                <EquipmentItem
                  item={items.find((i) => i.id === slots.mainHand)!}
                />
              )}
            </EquipmentSlot>

            <EquipmentSlot id="body" label={SLOT_LABELS.body}>
              {slots.body && (
                <EquipmentItem item={items.find((i) => i.id === slots.body)!} />
              )}
            </EquipmentSlot>

            <EquipmentSlot id="offHand" label={SLOT_LABELS.offHand}>
              {slots.offHand && (
                <EquipmentItem
                  item={items.find((i) => i.id === slots.offHand)!}
                />
              )}
            </EquipmentSlot>
          </div>

          <EquipmentSlot id="legs" label={SLOT_LABELS.legs}>
            {slots.legs && (
              <EquipmentItem item={items.find((i) => i.id === slots.legs)!} />
            )}
          </EquipmentSlot>
        </div>

        {/* Storage Section */}
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
              />
            ))}
          </SortableContext>
          {storageItems.length === 0 && (
            <p className="text-gray-500 text-sm">Storage is empty. Drag items here.</p>
          )}
        </StorageContainer>
      </DndContext>
    </div>
  );
}
