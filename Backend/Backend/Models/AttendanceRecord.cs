namespace Backend.Models
{
    /// <summary>
    /// Thực thể lưu vết lịch sử điểm danh của nhân viên
    /// </summary>
    public class AttendanceRecord
    {
        public int Id { get; set; }
        public int? PersonId { get; set; }
        public string PersonName { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.Now;
        public string Status { get; set; } = "Đúng giờ";
        public double Confidence { get; set; }
    }
}
