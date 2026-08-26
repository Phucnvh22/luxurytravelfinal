import AdminRoomWorkHistoryBoard from '../components/AdminRoomWorkHistoryBoard'

export default function AdminRoomRepairHistoryPage() {
  return (
    <AdminRoomWorkHistoryBoard
      mode="repair"
      title="Admin • Room Repair History"
      description="Mỗi villa là một card riêng, chỉ hiển thị lịch sử sửa phòng."
    />
  )
}
