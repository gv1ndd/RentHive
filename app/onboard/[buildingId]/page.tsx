'use client';

import React, { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  CheckCircle2,
  User,
  ShieldCheck,
  Send,
  BedDouble,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/currency';
import { parseRoomDisplay } from '@/lib/utils/room-helper';
import { Building } from '@/types/domain';

interface AvailableBedOption {
  bedId: string;
  bedLabel: string;
  roomNumber: string;
  floorNumber: number;
  rate: number;
}

export default function TenantOnboardingPage({
  params,
}: {
  params: Promise<{ buildingId: string }>;
}) {
  const resolvedParams = use(params);
  const buildingId = resolvedParams.buildingId;
  const supabase = createClient();

  const [building, setBuilding] = useState<Building | null>(null);
  const [availableBeds, setAvailableBeds] = useState<AvailableBedOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [govtIdNumber, setGovtIdNumber] = useState('');
  const [address, setAddress] = useState('');
  const [selectedBedId, setSelectedBedId] = useState<string>('');
  const [expectedMoveInDate, setExpectedMoveInDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function loadBuildingAndBeds() {
      setIsLoading(true);
      try {
        // 1. Fetch Building
        const { data: bData, error: bErr } = await supabase
          .from('buildings')
          .select('*')
          .eq('id', buildingId)
          .is('deleted_at', null)
          .single();

        if (bErr || !bData) {
          setErrorMsg('Property not found or link is invalid.');
          return;
        }

        setBuilding(bData as Building);

        // 2. Fetch Vacant Beds
        const { data: bedsData } = await (supabase.from('beds') as any)
          .select(`
            id,
            bed_label,
            default_rate,
            rooms (
              id,
              room_number,
              floor_number,
              building_id,
              deleted_at
            ),
            tenancies (
              id,
              check_out_date,
              deleted_at
            )
          `)
          .is('deleted_at', null);

        const { data: bookingsData } = await supabase
          .from('advance_bookings')
          .select('bed_id')
          .eq('status', 'pending')
          .is('deleted_at', null);

        const reservedIds = new Set((bookingsData || []).map((b: any) => b.bed_id).filter(Boolean));

        const options: AvailableBedOption[] = [];

        for (const b of (bedsData || []) as any[]) {
          if (!b.rooms || b.rooms.deleted_at || b.rooms.building_id !== buildingId) {
            continue;
          }

          const hasActive = (b.tenancies || []).some((t: any) => !t.check_out_date && !t.deleted_at);
          const isReserved = reservedIds.has(b.id);

          if (!hasActive && !isReserved) {
            options.push({
              bedId: b.id,
              bedLabel: b.bed_label,
              roomNumber: b.rooms.room_number,
              floorNumber: b.rooms.floor_number,
              rate: Number(b.default_rate || 0),
            });
          }
        }

        setAvailableBeds(options);
      } catch (e) {
        console.error('Error loading onboarding portal:', e);
      } finally {
        setIsLoading(false);
      }
    }

    loadBuildingAndBeds();
  }, [buildingId, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter your full name');
      return;
    }
    if (!phone.trim()) {
      alert('Please enter your mobile phone number');
      return;
    }
    if (!building) return;

    setIsSubmitting(true);
    try {
      const selectedBed = availableBeds.find((b) => b.bedId === selectedBedId);

      const noteText = [
        emergencyPhone ? `Emergency Contact: ${emergencyPhone}` : '',
        govtIdNumber ? `ID Proof / Aadhaar: ${govtIdNumber}` : '',
        address ? `Address: ${address}` : '',
        notes ? `Notes: ${notes}` : '',
      ]
        .filter(Boolean)
        .join(' | ');

      const { error: insertErr } = await supabase.from('advance_bookings').insert({
        owner_id: building.owner_id,
        building_id: building.id,
        bed_id: selectedBedId || null,
        tenant_name: name.trim(),
        tenant_phone: phone.trim(),
        total_amount: selectedBed ? selectedBed.rate : 0,
        paid_amount: 0,
        expected_move_in_date: expectedMoveInDate,
        status: 'pending',
      });

      if (insertErr) throw insertErr;

      setIsSuccess(true);
    } catch (e: any) {
      console.error('Onboarding submission error:', e);
      alert('Failed to submit registration: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 space-y-4 shadow-lg">
          <Skeleton className="h-10 w-48 mx-auto" />
          <Skeleton className="h-40 rounded-2xl" />
        </Card>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-3 shadow-lg border-2 border-border">
          <div className="w-12 h-12 rounded-2xl bg-status-pending/15 text-status-pending flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Link Invalid</h2>
          <p className="text-xs text-muted">{errorMsg}</p>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4 shadow-xl border-2 border-status-vacant/30 animate-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-3xl bg-status-vacant/15 text-status-vacant flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Application Received!</h1>
            <p className="text-xs text-muted mt-1.5 leading-relaxed">
              Thank you, <strong className="text-foreground">{name}</strong>. Your check-in details for{' '}
              <strong className="text-foreground">{building?.name}</strong> have been submitted to the property manager.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-surface-container/60 border border-border-subtle text-xs text-left space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted">Expected Move-in:</span>
              <span className="font-semibold text-foreground">{expectedMoveInDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Contact Phone:</span>
              <span className="font-semibold text-foreground">{phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Status:</span>
              <Badge variant="reserved" size="sm">
                Pending Approval
              </Badge>
            </div>
          </div>
          <p className="text-[11px] text-muted">
            The property owner will contact you shortly to confirm your room assignment.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Brand & Property Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Building2 className="w-3.5 h-3.5" />
            <span>{building?.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Tenant Check-In Intake</h1>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {building?.address || 'Please fill in your details below to register your room booking.'}
          </p>
        </div>

        {/* Form Card */}
        <Card className="p-6 shadow-xl border-2 border-border-subtle">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Personal Details */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>1. Personal Information</span>
              </h2>

              <Input
                label="Full Name *"
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Mobile / WhatsApp Phone *"
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
                <Input
                  label="Emergency Contact Phone"
                  type="tel"
                  placeholder="e.g. 9123456780 (Parent/Guardian)"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                />
              </div>

              <Input
                label="Aadhaar / Govt ID Number"
                type="text"
                placeholder="e.g. 1234-5678-9012"
                value={govtIdNumber}
                onChange={(e) => setGovtIdNumber(e.target.value)}
              />

              <Input
                label="Permanent Home Address"
                type="text"
                placeholder="City, State, Pin Code"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            {/* Room & Stay Preference */}
            <div className="space-y-3 pt-3 border-t border-border-subtle">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <BedDouble className="w-3.5 h-3.5" />
                <span>2. Room & Move-In Date</span>
              </h2>

              <Input
                label="Expected Move-In Date *"
                type="date"
                value={expectedMoveInDate}
                onChange={(e) => setExpectedMoveInDate(e.target.value)}
                required
              />

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Preferred Room & Bed (Optional)
                </label>
                {availableBeds.length === 0 ? (
                  <p className="text-xs text-muted p-3 bg-surface-container rounded-xl border border-border-subtle">
                    No specific beds pre-listed. The property manager will assign an available room upon review.
                  </p>
                ) : (
                  <select
                    value={selectedBedId}
                    onChange={(e) => setSelectedBedId(e.target.value)}
                    className="w-full bg-surface-container border border-border-subtle focus:border-primary rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Let Property Manager Assign Best Bed</option>
                    {availableBeds.map((b) => {
                      const parsed = parseRoomDisplay(b.roomNumber);
                      return (
                        <option key={b.bedId} value={b.bedId}>
                          Room {parsed.cleanRoomNumber} {parsed.isBalcony ? '🌿 (Balcony)' : ''} ({b.bedLabel}) — Floor {b.floorNumber} — {formatCurrency(b.rate)}/mo
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Additional Notes or Preferences
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Vegetarian room preference, upper floor, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-surface-container border border-border-subtle focus:border-primary rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                />
              </div>
            </div>

            {/* Submit CTA */}
            <div className="pt-3">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                isLoading={isSubmitting}
                leftIcon={<Send className="w-4 h-4" />}
              >
                Submit Registration
              </Button>
            </div>

            <p className="text-[10px] text-center text-muted flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>Your personal details are stored securely with Rent-Hive.</span>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
