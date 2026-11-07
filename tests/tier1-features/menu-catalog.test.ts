import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, teardownTestServer } from '../helpers/test-client.ts';

describe('Tier 1: Feature Coverage — Menu Catalog & Relational Modifiers', () => {
  after(async () => {
    await teardownTestServer();
  });

  it('1. GET /api/menu returns success flag, categories array, and products list', async () => {
    const res = await apiFetch('/api/menu');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.categories), 'categories must be an array');
    assert.ok(Array.isArray(res.data.products), 'products must be an array');
    assert.ok(res.data.products.length >= 3, 'Must return at least 3 menu dishes');
  });

  it('2. Products include nested relational modifier_groups (no free-text modifier fallback)', async () => {
    const res = await apiFetch('/api/menu');
    const burger = res.data.products.find((p: any) => p.name.includes('Hamburguesa'));
    assert.ok(burger, 'Hamburguesa must be present in menu');
    assert.ok(Array.isArray(burger.modifier_groups), 'modifier_groups must be an array');
    assert.ok(burger.modifier_groups.length >= 2, 'Burger must have at least 2 modifier groups');
  });

  it('3. Modifiers declare explicit action_type conforming to domain contract', async () => {
    const res = await apiFetch('/api/menu');
    const allModifiers = res.data.products.flatMap((p: any) =>
      p.modifier_groups.flatMap((g: any) => g.modifiers)
    );
    assert.ok(allModifiers.length > 0, 'Modifiers list should not be empty');

    const validActions = new Set(['NO', 'EXTRA', 'OPTION', 'SUBSTITUTE']);
    for (const mod of allModifiers) {
      assert.ok(
        validActions.has(mod.action_type),
        `Modifier ${mod.name} has invalid action_type: ${mod.action_type}`
      );
    }
  });

  it('4. Modifier groups enforce strict min_selection and max_selection cardinality', async () => {
    const res = await apiFetch('/api/menu');
    const burger = res.data.products.find((p: any) => p.name.includes('Hamburguesa'));
    const donenessGroup = burger.modifier_groups.find((g: any) => g.name.includes('Término'));

    assert.ok(donenessGroup, 'Doneness group must exist');
    assert.strictEqual(donenessGroup.min_selection, 1, 'Doneness must be mandatory (min=1)');
    assert.strictEqual(donenessGroup.max_selection, 1, 'Doneness must be single choice (max=1)');

    const toppingsGroup = burger.modifier_groups.find((g: any) => g.name.includes('Adiciones'));
    assert.ok(toppingsGroup, 'Toppings group must exist');
    assert.strictEqual(toppingsGroup.min_selection, 0, 'Toppings should be optional (min=0)');
    assert.ok(toppingsGroup.max_selection >= 1, 'Toppings allows multiple choices');
  });

  it('5. Product base prices and modifier price deltas are non-negative numeric amounts', async () => {
    const res = await apiFetch('/api/menu');
    for (const product of res.data.products) {
      assert.strictEqual(typeof product.base_price, 'number');
      assert.ok(product.base_price >= 0, `Product ${product.name} has invalid base_price`);

      for (const group of product.modifier_groups || []) {
        for (const mod of group.modifiers || []) {
          assert.strictEqual(typeof mod.price_delta, 'number');
          assert.ok(mod.price_delta >= 0, `Modifier ${mod.name} has negative price_delta`);
        }
      }
    }
  });
});
