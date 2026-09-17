"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, Input, Label, Select } from "@/components/ui";
import { toast } from "@/components/Toast";
import { useAuthStore } from "@/store/auth";
import { useSalesContacts } from "@/hooks/use-atlas-data";
import { deleteSalesContact, saveSalesContact } from "@/lib/firebase/sales-contacts";
import { deleteAccount, saveAccount } from "@/lib/firebase/accounts";
import { isAdminUser } from "@/lib/quotes/team-roles";
import { TEAM_ROLES } from "@/lib/quotes/team-roles";
import type { Account, SalesContact } from "@/lib/types";

const ACCOUNT_TYPES: NonNullable<Account["accountType"]>[] = ["prospect", "customer", "churned"];

const EMPTY_CONTACT = { name: "", title: "", email: "", phone: "", isPrimary: false };

export function AccountDetailPanel({
  account,
  onSaved,
  onDeleted,
}: {
  account: Account;
  onSaved: (next: Account) => void;
  onDeleted: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const { data: contacts = [] } = useSalesContacts(account.id);
  const [edit, setEdit] = useState(account);
  const [busy, setBusy] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT);

  const canReassignOwner = isAdminUser(user?.username, user?.role) || account.owner === user?.username;

  async function save() {
    setBusy(true);
    try {
      await saveAccount({ ...edit, id: account.id });
      onSaved(edit);
      toast("Account saved", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save account", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete account "${account.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteAccount(account.id);
      onDeleted();
      toast("Account deleted", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete account", "error");
    } finally {
      setBusy(false);
    }
  }

  async function addContact() {
    if (!contactForm.name.trim()) {
      toast("Contact name is required", "error");
      return;
    }
    setBusy(true);
    try {
      await saveSalesContact({
        accountId: account.id,
        name: contactForm.name,
        title: contactForm.title,
        email: contactForm.email,
        phone: contactForm.phone,
        isPrimary: contactForm.isPrimary,
        owner: account.owner,
      });
      setContactForm(EMPTY_CONTACT);
      setAddingContact(false);
      toast("Contact added", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add contact", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeContact(contact: SalesContact) {
    if (!confirm(`Remove contact "${contact.name}"?`)) return;
    try {
      await deleteSalesContact(contact.id);
      toast("Contact removed", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not remove contact", "error");
    }
  }

  const owners = Object.keys(TEAM_ROLES).filter((k) => k !== "ganny");

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-[14rem] flex-1">
          <Label>Account name *</Label>
          <Input value={edit.name} onChange={(e) => setEdit((a) => ({ ...a, name: e.target.value }))} />
        </div>
        <Button type="button" variant="secondary" size="sm" className="mt-5 gap-1.5 text-red-700" onClick={() => void remove()}>
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label>Industry</Label>
          <Input value={edit.industry || ""} onChange={(e) => setEdit((a) => ({ ...a, industry: e.target.value }))} />
        </div>
        <div>
          <Label>Website</Label>
          <Input value={edit.website || ""} onChange={(e) => setEdit((a) => ({ ...a, website: e.target.value }))} />
        </div>
        <div>
          <Label>Account type</Label>
          <Select
            value={edit.accountType || "prospect"}
            onChange={(e) => setEdit((a) => ({ ...a, accountType: e.target.value as Account["accountType"] }))}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Owner {canReassignOwner ? "" : "(admin only to reassign)"}</Label>
          <Select
            value={edit.owner}
            disabled={!canReassignOwner}
            onChange={(e) => setEdit((a) => ({ ...a, owner: e.target.value }))}
          >
            {owners.map((id) => (
              <option key={id} value={id}>
                {TEAM_ROLES[id]?.name || id}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Territory</Label>
          <Input value={edit.territory || ""} onChange={(e) => setEdit((a) => ({ ...a, territory: e.target.value }))} />
        </div>
        <div>
          <Label>Contract renewal date</Label>
          <Input
            type="date"
            value={edit.contractRenewalDate || ""}
            onChange={(e) => setEdit((a) => ({ ...a, contractRenewalDate: e.target.value }))}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Label>Billing address</Label>
          <Input value={edit.billingAddress || ""} onChange={(e) => setEdit((a) => ({ ...a, billingAddress: e.target.value }))} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Label>Notes</Label>
          <Input value={edit.notes || ""} onChange={(e) => setEdit((a) => ({ ...a, notes: e.target.value }))} />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button type="button" disabled={busy || !edit.name.trim()} onClick={() => void save()}>
          Save account
        </Button>
      </div>

      <h3 className="mt-5 text-sm font-bold">Contacts</h3>
      <ul className="mt-2 space-y-2 text-sm">
        {contacts.length === 0 ? (
          <li className="text-[var(--color-text-muted)]">No contacts yet.</li>
        ) : (
          contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <div>
                <span className="font-semibold">{c.name}</span>
                {c.isPrimary ? (
                  <span className="ml-2">
                    <Badge tone="info">Primary</Badge>
                  </span>
                ) : null}
                <div className="text-xs text-[var(--color-text-muted)]">
                  {[c.title, c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <button type="button" className="text-red-700" onClick={() => void removeContact(c)} aria-label={`Remove ${c.name}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))
        )}
      </ul>

      {addingContact ? (
        <div className="mt-3 grid gap-2 rounded-lg border border-[var(--color-border)] bg-sky-50/40 p-3 sm:grid-cols-2">
          <div>
            <Label>Name *</Label>
            <Input value={contactForm.name} onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <Label>Title</Label>
            <Input value={contactForm.title} onChange={(e) => setContactForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={contactForm.isPrimary}
              onChange={(e) => setContactForm((f) => ({ ...f, isPrimary: e.target.checked }))}
            />
            Primary contact
          </label>
          <div className="flex items-end justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setAddingContact(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={busy} onClick={() => void addContact()}>
              Add contact
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="secondary" size="sm" className="mt-2 gap-1.5" onClick={() => setAddingContact(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add contact
        </Button>
      )}
    </Card>
  );
}
