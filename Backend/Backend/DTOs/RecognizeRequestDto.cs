namespace Backend.DTOs
{
    /// <summary>
    /// DTO nhận dữ liệu ảnh hoặc vector gửi lên từ camera khi thực hiện quét nhận diện
    /// </summary>
    public class RecognizeRequestDto
    {
        /// <summary>
        /// Chuỗi ảnh định dạng Base64 vừa chụp từ Webcam/Camera
        /// </summary>
        public string? FaceImage { get; set; }

        /// <summary>
        /// Hoặc mảng vector đặc trưng đã trích xuất từ client/AI
        /// </summary>
        public float[]? FaceVector { get; set; }
    }
}
