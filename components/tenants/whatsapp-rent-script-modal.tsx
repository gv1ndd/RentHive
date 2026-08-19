'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Copy, Check, Send, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';

interface WhatsAppRentScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantName: string;
  tenantPhone: string | null;
  buildingName?: string;
  roomNumber?: string;
  bedLabel?: string;
  defaultRent?: number;
  defaultElectricity?: number;
}

export function WhatsAppRentScriptModal({
  isOpen,
  onClose,
  tenantName,
  tenantPhone,
  buildingName,
  roomNumber,
  bedLabel,
  defaultRent = 0,
  defaultElectricity = 0,
}: WhatsAppRentScriptModalProps) {
  const [rent, setRent] = useState(defaultRent);
  const [electricity, setElectricity] = useState(defaultElectricity);
  const [cleaning, setCleaning] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [otherLabel, setOtherLabel] = useState('Maintenance / Other');
  const [customNote, setCustomNote] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRent(defaultRent);
      setElectricity(defaultElectricity);
      setCleaning(0);
      setOtherCharges(0);
      setIsCopied(false);
    }
  }, [isOpen, defaultRent, defaultElectricity]);

  const total = Number(rent || 0) + Number(electricity || 0) + Number(cleaning || 0) + Number(otherCharges || 0);

  // Generate the formatted WhatsApp text
  const generateScript = () => {
    let script = `*Rent Invoice / Bill Summary*\n`;
    script += `Hi ${tenantName}, here is your rent and utility breakdown:\n\n`;

    if (buildingName || roomNumber) {
      script += `🏠 *Property:* ${buildingName || ''} ${roomNumber ? `(Room ${roomNumber}${bedLabel ? ` - ${bedLabel}` : ''})` : ''}\n\n`;
    }

    script += `• *Rent:* ₹${Number(rent || 0).toLocaleString('en-IN')}\n`;
    script += `• *Electricity Bill:* ₹${Number(electricity || 0).toLocaleString('en-IN')}\n`;

    if (Number(cleaning || 0) > 0) {
      script += `• *Cleaning:* ₹${Number(cleaning || 0).toLocaleString('en-IN')}\n`;
    }

    if (Number(otherCharges || 0) > 0) {
      script += `• *${otherLabel}:* ₹${Number(otherCharges || 0).toLocaleString('en-IN')}\n`;
    }

    script += `-------------------------\n`;
    script += `*Total Due: ₹${Number(total).toLocaleString('en-IN')}*\n`;

    if (customNote.trim()) {
      script += `\n📝 _Note: ${customNote.trim()}_\n`;
    }

    script += `\nPlease settle the payment at your earliest convenience via UPI or cash. Thank you!`;

    return script;
  };

  const scriptText = generateScript();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(scriptText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (e) {
      console.error('Failed to copy to clipboard', e);
    }
  };

  const handleSendWhatsApp = () => {
    const rawPhone = (tenantPhone || '').replace(/[^0-9]/g, '');
    // Ensure international code (defaulting to 91 for India if 10 digits)
    const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(scriptText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Rent Breakdown via WhatsApp"
      description={`Generate a formatted WhatsApp rent script for ${tenantName}.`}
    >
      <div className="space-y-4 pt-2">
        {!tenantPhone && (
          <div className="p-3 rounded-xl bg-status-reserved/15 border border-status-reserved/30 text-xs flex items-center gap-2 text-foreground">
            <AlertCircle className="w-4 h-4 text-status-reserved shrink-0" />
            <span>No phone on file. WhatsApp will open with pre-filled text so you can select the recipient.</span>
          </div>
        )}

        {/* Breakdown Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Rent (₹)"
            type="number"
            value={rent}
            onChange={(e) => setRent(Number(e.target.value))}
            min={0}
          />
          <Input
            label="Electricity Bill (₹)"
            type="number"
            value={electricity}
            onChange={(e) => setElectricity(Number(e.target.value))}
            min={0}
          />
          <Input
            label="Cleaning (₹)"
            type="number"
            value={cleaning}
            onChange={(e) => setCleaning(Number(e.target.value))}
            min={0}
            placeholder="0 (if any)"
          />
          <Input
            label="Other / Maintenance (₹)"
            type="number"
            value={otherCharges}
            onChange={(e) => setOtherCharges(Number(e.target.value))}
            min={0}
            placeholder="0 (if any)"
          />
        </div>

        {/* Custom Note */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Optional Note / UPI ID
          </label>
          <input
            type="text"
            placeholder="e.g. UPI ID: 9876543210@upi or Due by 5th"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            className="w-full bg-surface-container border border-border-subtle focus:border-primary rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
          />
        </div>

        {/* Live Preview Box */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-muted">Formatted WhatsApp Message</span>
            <span className="text-xs font-bold text-primary">
              Total: {formatCurrency(total)}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-surface-container/90 border border-border-subtle text-xs font-mono text-foreground whitespace-pre-wrap select-all max-h-48 overflow-y-auto leading-relaxed shadow-inner">
            {scriptText}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-border-subtle">
          <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto">
            Close
          </Button>

          <Button
            variant="tonal"
            size="sm"
            onClick={handleCopy}
            leftIcon={isCopied ? <Check className="w-4 h-4 text-status-vacant" /> : <Copy className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            {isCopied ? 'Copied to Clipboard!' : 'Copy Script'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleSendWhatsApp}
            leftIcon={<Send className="w-4 h-4" />}
            className="w-full sm:w-auto bg-[#25D366] hover:bg-[#20bd5a] text-white border-none"
          >
            Send via WhatsApp
          </Button>
        </div>
      </div>
    </Modal>
  );
}
