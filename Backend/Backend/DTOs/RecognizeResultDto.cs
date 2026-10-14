namespace Backend.DTOs
{
    /// <summary>
    /// DTO trả kết quả nhận diện khuôn mặt về cho client hiển thị lên giao diện
    /// </summary>
    public class RecognizeResultDto
    {
        /// <summary>
        /// True nếu tìm thấy người khớp, False nếu là người lạ (chưa đăng ký)
        /// </summary>
        public bool IsMatched { get; set; }

        /// <summary>
        /// Id của người được nhận diện (null nếu không khớp)
        /// </summary>
        public int? PersonId { get; set; }

        /// <summary>
        /// Tên người được nhận diện (hoặc "Người lạ / Unknown")
        /// </summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Khoảng cách sai số Euclidean (càng gần 0 càng chính xác)
        /// </summary>
        public double Distance { get; set; }

        /// <summary>
        /// Độ tin cậy / Tỉ lệ tương đồng tính theo % (0 - 100%)
        /// </summary>
        public double Confidence { get; set; }

        /// <summary>
        /// Thông báo trạng thái hiển thị cho người dùng (vd: "Điểm danh thành công!", "Không nhận diện được")
        /// </summary>
        public string Message { get; set; } = string.Empty;
    }
}
