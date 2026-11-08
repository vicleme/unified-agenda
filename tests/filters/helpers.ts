import { createItem, createTag, type Item, type Tag } from '../../src/core';
import { testContext } from '../core/helpers';

export const SP = 'America/Sao_Paulo'; // UTC-3 all year since 2019
const ctx = testContext();

export function task(title: string, extra: Partial<Parameters<typeof createItem>[0]> = {}): Item {
  return createItem({ kind: 'task', title, agendaId: 'a', statusId: 's-planned', ...extra }, ctx);
}

export function event(title: string, extra: Partial<Parameters<typeof createItem>[0]> = {}): Item {
  return createItem({ kind: 'event', title, agendaId: 'a', ...extra }, ctx);
}

export function tag(name: string, parentId: string | null = null): Tag {
  return createTag({ name, color: '#3b5bdb', parentId }, ctx);
}

export const titles = (items: readonly Item[]) => items.map((item) => item.title);
