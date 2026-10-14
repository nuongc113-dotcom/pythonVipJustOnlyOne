namespace Backend.DTOs
{
    /// <summary>
    /// DTO nhận dữ liệu gửi lên từ client lúc Đăng ký khuôn mặt
    /// </summary>
    public class RegisterPersonDto
    {
        /// <summary>
        /// Họ và tên người đăng ký
        /// </summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Chuỗi ảnh định dạng Base64 gửi từ Camera/Webcam (ví dụ: data:image/jpeg;base64,...)
        /// </summary>
        public string? FaceImage { get; set; }

        /// <summary>
        /// Mảng vector đặc trưng nếu client hoặc AI service đã trích xuất sẵn (vd: mảng 128 số thực)
        /// </summary>
        public float[]? FaceVector { get; set; }
    }
}
