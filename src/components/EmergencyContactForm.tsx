import React, { useState } from 'react';
import { useAgentStore } from '../store/agentStore';
import { EmergencyContact } from '../types';
import { User, Phone, Mail, Heart, Plus, Trash2, Save } from 'lucide-react';

export const EmergencyContactForm: React.FC = () => {
  const { contacts, setContacts, userProfile, setUserProfile, addLog } = useAgentStore();

  // Profile forms
  const [profileName, setProfileName] = useState(userProfile.name);
  const [bloodType, setBloodType] = useState(userProfile.bloodType);
  const [medConditions, setMedConditions] = useState(userProfile.medicalConditions);
  const [allergies, setAllergies] = useState(userProfile.allergies);

  // Contact input forms
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactRelation, setContactRelation] = useState('Family');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setUserProfile({
      name: profileName,
      bloodType,
      medicalConditions: medConditions,
      allergies
    });
    addLog('INFO', 'Saved user medical profile changes.');
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactPhone.trim()) {
      alert('Name and Phone number are required.');
      return;
    }

    const newContact: EmergencyContact = {
      id: `${Date.now()}`,
      name: contactName,
      phone: contactPhone,
      email: contactEmail,
      relation: contactRelation
    };

    const updatedContacts = [...contacts, newContact];
    setContacts(updatedContacts);
    addLog('INFO', `Added emergency contact: ${contactName} (${contactRelation})`);

    // Reset forms
    setContactName('');
    setContactPhone('');
    setContactEmail('');
    setContactRelation('Family');
  };

  const handleDeleteContact = (id: string) => {
    const contactToDelete = contacts.find(c => c.id === id);
    const updatedContacts = contacts.filter(c => c.id !== id);
    setContacts(updatedContacts);
    if (contactToDelete) {
      addLog('INFO', `Removed emergency contact: ${contactToDelete.name}`);
    }
  };

  return (
    <div className="settings-grid">
      {/* Profile Card */}
      <div className="settings-card">
        <h2 className="section-title flex-align">
          <User className="w-5 h-5 text-indigo-400" />
          <span>User Medical Info</span>
        </h2>
        <p className="section-subtitle">Important variables transmitted during alert dispatch</p>

        <form onSubmit={handleSaveProfile} className="form-layout">
          <div className="input-group">
            <label className="input-label">Full Name</label>
            <input 
              type="text" 
              className="text-input" 
              placeholder="e.g. John Doe"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Blood Type</label>
            <select 
              className="text-input"
              value={bloodType}
              onChange={(e) => setBloodType(e.target.value)}
            >
              <option value="">Select Blood Type</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Medical Conditions</label>
            <textarea 
              className="text-input text-area" 
              placeholder="e.g. Asthma, Diabetes, Heart Conditions..."
              value={medConditions}
              onChange={(e) => setMedConditions(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Allergies</label>
            <input 
              type="text" 
              className="text-input" 
              placeholder="e.g. Penicillin, Peanuts"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-flex mt-2">
            <Save className="w-4 h-4" />
            <span>Save Profile Parameters</span>
          </button>
        </form>
      </div>

      {/* Contacts Card */}
      <div className="settings-card">
        <h2 className="section-title flex-align">
          <Heart className="w-5 h-5 text-rose-400" />
          <span>Emergency Contacts</span>
        </h2>
        <p className="section-subtitle">Who to notify autonomously during accident events</p>

        {/* Added Contacts list */}
        <div className="contact-list">
          {contacts.length === 0 ? (
            <p className="empty-contacts">No contacts configured. Please add at least one below.</p>
          ) : (
            contacts.map((contact) => (
              <div key={contact.id} className="contact-item">
                <div>
                  <div className="contact-meta">
                    <span className="contact-name">{contact.name}</span>
                    <span className="contact-badge">{contact.relation}</span>
                  </div>
                  <div className="contact-details">
                    <span className="flex-align"><Phone className="w-3.5 h-3.5" />{contact.phone}</span>
                    {contact.email && <span className="flex-align"><Mail className="w-3.5 h-3.5" />{contact.email}</span>}
                  </div>
                </div>
                <button 
                  onClick={() => handleDeleteContact(contact.id)}
                  className="btn-delete"
                  title="Delete contact"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add Contact Form */}
        <form onSubmit={handleAddContact} className="form-layout border-top mt-4 pt-4">
          <h3 className="form-header">Add New Contact</h3>
          
          <div className="input-group">
            <label className="input-label">Contact Name *</label>
            <input 
              type="text" 
              className="text-input" 
              placeholder="e.g. Jane Doe"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Phone Number * (inc. country code)</label>
            <input 
              type="tel" 
              className="text-input" 
              placeholder="e.g. +14155552671"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Email Address (for fallback mailto)</label>
            <input 
              type="email" 
              className="text-input" 
              placeholder="e.g. jane@example.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Relationship</label>
            <select 
              className="text-input"
              value={contactRelation}
              onChange={(e) => setContactRelation(e.target.value)}
            >
              <option value="Family">Family</option>
              <option value="Partner">Partner</option>
              <option value="Doctor">Doctor</option>
              <option value="Friend">Friend</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <button type="submit" className="btn btn-secondary btn-flex mt-2">
            <Plus className="w-4 h-4" />
            <span>Add Contact Point</span>
          </button>
        </form>
      </div>
    </div>
  );
};
