// ⚠️ MUST match the order in FreelanceEscrow.sol enum Status
// enum Status { Created, Accepted, Submitted, Disputed, Released, Refunded }
export const STATUS = [
  { label: "Created", color: "bg-blue-100 text-blue-700" },     // 0
  { label: "Accepted", color: "bg-yellow-100 text-yellow-700" }, // 1
  { label: "Submitted", color: "bg-purple-100 text-purple-700" }, // 2
  { label: "Disputed", color: "bg-red-100 text-red-700" },       // 3
  { label: "Released", color: "bg-green-100 text-green-700" },   // 4
  { label: "Refunded", color: "bg-gray-100 text-gray-700" },     // 5
];
