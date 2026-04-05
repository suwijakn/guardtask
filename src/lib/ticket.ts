// Ticket number generator

let ticketCounter = 0;

export function generateTicketNumber(): string {
  const year = new Date().getFullYear() + 543; // Buddhist era
  ticketCounter++;
  const seq = ticketCounter.toString().padStart(4, '0');
  return `LV-${year}-${seq}`;
}

export function resetTicketCounter(): void {
  ticketCounter = 0;
}
