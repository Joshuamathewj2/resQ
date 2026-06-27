/**
 * @file src/components/EmergencyContactForm.tsx
 * @description Settings panel for user medical profile and emergency contacts.
 *
 * Provides two forms:
 * 1. **User Medical Profile** — name, blood type, medical conditions, allergies.
 *    Persisted to localStorage via the Zustand store action `setUserProfile`.
 * 2. **Emergency Contacts** — list of contacts to notify during an incident.
 *    Persisted to localStorage via the Zustand store action `setContacts`.
 *
 * All changes are immediately saved to localStorage and reflected in emergency
 * alert messages without requiring an app restart.
 */

import React, { useState } from 'react';
import { useAgentStore } from '../store/agentStore';
import { EmergencyContact } from '../types';
import { User, Phone, Mail, Heart, Plus, Trash2, Save } from 'lucide-react';

/** Supported blood type options for the dropdown. */
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

/** Supported relationship labels for emergency contact categorisation. */
const RELATION_OPTIONS = ['Family', 'Partner', 'Spouse', 'Friend', 'Doctor', 'Colleague', 'Other'] as const;

/**
 * Validates that an E.164 or local phone number string looks reasonable.
 * Does not guarantee full international validity — just prevents obviously
 * malformed entries from being saved.
 *
 * @param phone - The phone number string to validate
 * @returns true if the value looks like a phone number
 */
function isValidPhone(phone: string): boolean {
  return /^[+\d\s\-().]{7,20}$/.test(phone.trim());
}

/**
 * Combined medical profile and emergency contact settings panel.
 *
 * @example
 * ```tsx
 * <EmergencyContactForm />
 * ```
 */
export const EmergencyContactForm: React.FC = () => {
  const { contacts, setContacts, userProfile, setUserProfile, addLog } = useAgentStore();

  // ── Medical Profile State ────────────────────────────────────────────────
  const [profileName, setProfileName] = useState(userProfile.name);
  const [bloodType, setBloodType] = useState(userProfile.bloodType);
  const [medConditions, setMedConditions] = useState(userProfile.medicalConditions);
  const [allergies, setAllergies] = useState(userProfile.allergies);

  // ── Contact Add Form State ───────────────────────────────────────────────
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactRelation, setContactRelation] = useState<string>('Family');
  const [phoneError, setPhoneError] = useState<string>('');

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Saves the user medical profile to localStorage via Zustand store.
   * Validates that the name field is non-empty before saving.
   *
   * @param e - React form submit event
   */
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      alert('Please enter your name before saving.');
      return;
    }
    setUserProfile({
      name: profileName.trim(),
      bloodType,
      medicalConditions: medConditions,
      allergies,
    });
    addLog('INFO', `💾 User medical profile saved: ${profileName.trim()}`);
  };

  /**
   * Adds a new emergency contact to the contacts list.
   * Validates name and phone number format before saving.
   *
   * @param e - React form submit event
   */
  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');

    if (!contactName.trim()) {
      alert('Contact name is required.');
      return;
    }
    if (!contactPhone.trim()) {
      setPhoneError('Phone number is required.');
      return;
    }
    if (!isValidPhone(contactPhone)) {
      setPhoneError('Invalid phone number. Include country code (e.g. +1 415 555 2671).');
      return;
    }

    const newContact: EmergencyContact = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: contactName.trim(),
      phone: contactPhone.trim(),
      email: contactEmail.trim(),
      relation: contactRelation,
    };

    setContacts([...contacts, newContact]);
    addLog('INFO', `📋 Added emergency contact: ${newContact.name} (${newContact.relation}) — ${newContact.phone}`);

    // Reset form fields
    setContactName('');
    setContactPhone('');
    setContactEmail('');
    setContactRelation('Family');
  };

  /**
   * Removes an emergency contact by its ID.
   *
   * @param id - The contact ID to remove
   */
  const handleDeleteContact = (id: string) => {
    const contact = contacts.find(c => c.id === id);
    setContacts(contacts.filter(c => c.id !== id));
    if (contact) {
      addLog('INFO', `🗑️ Removed emergency contact: ${contact.name}`);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="settings-grid" id="settings-panel">
      {/* ── Medical Profile Card ─────────────────────────────────────────── */}
      <div className="settings-card">
        <h2 className="section-title flex-align">
          <User className="w-5 h-5 text-indigo-400" />
          <span>User Medical Profile</span>
        </h2>
        <p className="section-subtitle">
          Transmitted to emergency contacts and first responders during dispatch
        </p>

        <form onSubmit={handleSaveProfile} className="form-layout">
          <div className="input-group">
            <label htmlFor="profile-name" className="input-label">
              Full Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="profile-name"
              type="text"
              className="text-input"
              placeholder="e.g. John Doe"
              value={profileName}
              onChange={e => setProfileName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="input-group">
            <label htmlFor="blood-type" className="input-label">
              Blood Type
            </label>
            <select
              id="blood-type"
              className="text-input"
              value={bloodType}
              onChange={e => setBloodType(e.target.value)}
            >
              <option value="">Select Blood Type</option>
              {BLOOD_TYPES.map(bt => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label htmlFor="med-conditions" className="input-label">
              Medical Conditions
            </label>
            <textarea
              id="med-conditions"
              className="text-input text-area"
              placeholder="e.g. Asthma, Type 2 Diabetes, Epilepsy..."
              value={medConditions}
              onChange={e => setMedConditions(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label htmlFor="allergies" className="input-label">
              Known Allergies
            </label>
            <input
              id="allergies"
              type="text"
              className="text-input"
              placeholder="e.g. Penicillin, Peanuts, Latex"
              value={allergies}
              onChange={e => setAllergies(e.target.value)}
            />
          </div>

          <button id="btn-save-profile" type="submit" className="btn btn-primary btn-flex mt-2">
            <Save className="w-4 h-4" />
            <span>Save Medical Profile</span>
          </button>
        </form>
      </div>

      {/* ── Emergency Contacts Card ──────────────────────────────────────── */}
      <div className="settings-card">
        <h2 className="section-title flex-align">
          <Heart className="w-5 h-5 text-rose-400" />
          <span>Emergency Contacts</span>
        </h2>
        <p className="section-subtitle">
          Notified autonomously via SMS and email when an emergency is confirmed
        </p>

        {/* Contacts List */}
        <div className="contact-list" aria-label="Configured emergency contacts">
          {contacts.length === 0 ? (
            <p className="empty-contacts">
              No contacts configured. Add at least one contact below.
            </p>
          ) : (
            contacts.map(contact => (
              <div key={contact.id} className="contact-item">
                <div>
                  <div className="contact-meta">
                    <span className="contact-name">{contact.name}</span>
                    <span className="contact-badge">{contact.relation}</span>
                  </div>
                  <div className="contact-details">
                    <span className="flex-align">
                      <Phone className="w-3.5 h-3.5" />
                      {contact.phone}
                    </span>
                    {contact.email && (
                      <span className="flex-align">
                        <Mail className="w-3.5 h-3.5" />
                        {contact.email}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteContact(contact.id)}
                  className="btn-delete"
                  title={`Delete contact: ${contact.name}`}
                  aria-label={`Delete contact ${contact.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add Contact Form */}
        <form
          onSubmit={handleAddContact}
          className="form-layout border-top mt-4 pt-4"
          aria-label="Add new emergency contact"
        >
          <h3 className="form-header">Add New Contact</h3>

          <div className="input-group">
            <label htmlFor="contact-name" className="input-label">
              Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="contact-name"
              type="text"
              className="text-input"
              placeholder="e.g. Jane Doe"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="input-group">
            <label htmlFor="contact-phone" className="input-label">
              Phone <span style={{ color: '#ef4444' }}>*</span> (include country code)
            </label>
            <input
              id="contact-phone"
              type="tel"
              className={`text-input ${phoneError ? 'input-error' : ''}`}
              placeholder="e.g. +14155552671"
              value={contactPhone}
              onChange={e => {
                setContactPhone(e.target.value);
                setPhoneError('');
              }}
              autoComplete="tel"
            />
            {phoneError && (
              <p style={{ color: '#f87171', fontSize: '0.75rem', marginTop: '4px' }}>
                {phoneError}
              </p>
            )}
          </div>

          <div className="input-group">
            <label htmlFor="contact-email" className="input-label">
              Email (optional — for fallback mailto)
            </label>
            <input
              id="contact-email"
              type="email"
              className="text-input"
              placeholder="e.g. jane@example.com"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <label htmlFor="contact-relation" className="input-label">
              Relationship
            </label>
            <select
              id="contact-relation"
              className="text-input"
              value={contactRelation}
              onChange={e => setContactRelation(e.target.value)}
            >
              {RELATION_OPTIONS.map(rel => (
                <option key={rel} value={rel}>
                  {rel}
                </option>
              ))}
            </select>
          </div>

          <button id="btn-add-contact" type="submit" className="btn btn-secondary btn-flex mt-2">
            <Plus className="w-4 h-4" />
            <span>Add Emergency Contact</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default EmergencyContactForm;
