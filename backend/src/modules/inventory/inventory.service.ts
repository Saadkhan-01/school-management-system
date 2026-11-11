
import { AppError } from "../../utils/AppError";
import { escapeRegex, pageOptions } from "../website/website.service";
import { InventoryCategory, InventoryItem, InventoryTransaction, Supplier } from "./inventory.model";
import type { Actor } from "../academic-scope";
const meta = (page: number, limit: number, total: number) => ({ page, limit, total, pages: Math.ceil(total / limit) });
export async function createCategory(input: { name: string; description?: string }) { if (await InventoryCategory.findOne({ name: input.name }).lean()) throw new AppError(409, "CATEGORY_EXISTS", "An inventory category with this name already exists"); return InventoryCategory.create(input); }
export async function listCategories() { return InventoryCategory.find().sort({ name: 1 }).lean(); }
export async function updateCategory(id: string, input: Record<string, unknown>) { const doc = await InventoryCategory.findByIdAndUpdate(id, input, { new: true }); if (!doc) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found"); return doc; }
export async function createSupplier(input: Record<string, unknown>) { if (await Supplier.findOne({ name: input.name }).lean()) throw new AppError(409, "SUPPLIER_EXISTS", "A supplier with this name already exists"); return Supplier.create(input); }
export async function listSuppliers() { return Supplier.find().sort({ name: 1 }).lean(); }
export async function updateSupplier(id: string, input: Record<string, unknown>) { const doc = await Supplier.findByIdAndUpdate(id, input, { new: true }); if (!doc) throw new AppError(404, "SUPPLIER_NOT_FOUND", "Supplier not found"); return doc; }
export async function createItem(input: { name: string; categoryId: string; unit?: string; lowStockThreshold?: number }) {
  if (!(await InventoryCategory.findById(input.categoryId).lean())) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
  return InventoryItem.create({ name: input.name, category: input.categoryId, unit: input.unit ?? "pcs", lowStockThreshold: input.lowStockThreshold ?? 0, quantityOnHand: 0 });
}
export async function listItems(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query); const filter: Record<string, unknown> = {};
  if (typeof query.categoryId === "string") filter.category = query.categoryId;
  if (typeof query.search === "string" && query.search.trim()) filter.name = { $regex: escapeRegex(query.search.trim()), $options: "i" };
  if (query.lowStock === "true") filter.$expr = { $lte: ["$quantityOnHand", "$lowStockThreshold"] };
  const [items, total] = await Promise.all([InventoryItem.find(filter).populate("category", "name").sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(), InventoryItem.countDocuments(filter)]);
  return { items, meta: meta(page, limit, total) };
}
export async function updateItem(id: string, input: Record<string, unknown>) {
  const patch: Record<string, unknown> = { ...input }; if (input.categoryId) { patch.category = input.categoryId; delete patch.categoryId; }
  const doc = await InventoryItem.findByIdAndUpdate(id, patch, { new: true }); if (!doc) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found"); return doc;
}
export async function recordTransaction(actor: Actor, input: { itemId: string; type: string; quantity: number; supplierId?: string; reference?: string; note?: string }) {
  const item = await InventoryItem.findById(input.itemId); if (!item) throw new AppError(404, "ITEM_NOT_FOUND", "Item not found");
  if (input.supplierId && !(await Supplier.findById(input.supplierId).lean())) throw new AppError(404, "SUPPLIER_NOT_FOUND", "Supplier not found");
  const signed = input.type === "issued" ? -Math.abs(input.quantity) : input.quantity;
  // Recompute from the transaction ledger (source of truth), then apply.
  const agg = await InventoryTransaction.aggregate([{ $match: { item: item._id } }, { $group: { _id: null, total: { $sum: "$quantity" } } }]);
  const current = Number(agg[0]?.total ?? 0);
  const balanceAfter = current + signed;
  if (balanceAfter < 0) throw new AppError(409, "INSUFFICIENT_STOCK", `Cannot record this transaction: only ${current} on hand, requested change ${signed}`);
  const tx = await InventoryTransaction.create({ item: item._id, type: input.type, quantity: signed, supplier: input.supplierId, reference: input.reference, note: input.note, recordedBy: actor.id, balanceAfter });
  item.quantityOnHand = balanceAfter; await item.save();
  return tx;
}
export async function listTransactions(query: Record<string, unknown>) {
  const { page, limit } = pageOptions(query); const filter: Record<string, unknown> = {};
  if (typeof query.itemId === "string") filter.item = query.itemId;
  if (typeof query.type === "string") filter.type = query.type;
  const [items, total] = await Promise.all([InventoryTransaction.find(filter).populate("item", "name unit").populate("supplier", "name").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), InventoryTransaction.countDocuments(filter)]);
  return { items, meta: meta(page, limit, total) };
}
export async function lowStock() { const items = await InventoryItem.find().populate("category", "name").lean(); return items.filter((i) => i.quantityOnHand <= i.lowStockThreshold); }
