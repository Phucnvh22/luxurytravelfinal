import AdminRoomWorkHistoryBoard from '../components/AdminRoomWorkHistoryBoard'

export default function AdminRoomCleaningHistoryPage() {
  return (
    <AdminRoomWorkHistoryBoard
      mode="cleaning"
      title="Admin • Room Cleaning History"
      description="Mỗi villa là một card riêng, chỉ hiển thị lịch sử dọn phòng."
    />
  )
}
