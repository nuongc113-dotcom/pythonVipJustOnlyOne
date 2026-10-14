/**
 * ===================================================================
 * 🚀 JAVASCRIPT CONTROLLER - FACE ATTENDANCE AI PRO
 * ===================================================================
 * Tích hợp:
 *  1. Camera WebRTC HTML5
 *  2. Gửi ảnh sang Python AI (YuNet + SFace) tại port 5001
 *  3. Ghi nhận điểm danh & Quản lý danh sách sang C# Backend tại port 5286
 *  4. Âm thanh Web Audio & Giọng nói tiếng Việt Web Speech
 * ===================================================================
 */

// Cấu hình kết nối Localhost
const CONFIG = {
    AI_API_URL: "http://localhost:5001",     // Python AI Flask Service (YuNet + SFace)
    BACKEND_URL: "http://localhost:5286"    // ASP.NET Core C# Backend (.NET 10)
};

// Global State
let attendanceStream = null;
let registerStream = null;
let currentSnapshotBase64 = null;
let autoScanInterval = null;
let isScanning = false;
let peopleDatabase = [];

// Vai trò & Chế độ điểm danh (Lưu trong LocalStorage)
let currentRole = localStorage.getItem("face_attendance_role") || "manager"; // "manager" | "employee"
let currentAttendanceMode = localStorage.getItem("face_attendance_mode") || (new Date().getHours() >= 12 ? "Check-out" : "Check-in");

// ===================================================================
// 1. KHỞI TẠO VÀ ĐIỀU HƯỚNG TABS
// ===================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Cập nhật đồng hồ thời gian thực
    updateLiveClock();
    setInterval(updateLiveClock, 1000);

    // Khởi tạo hệ thống phân quyền (Quản lý vs Nhân viên)
    initRoleSystem();

    // Khởi tạo chế độ điểm danh (Check-in / Check-out)
    selectAttendanceMode(currentAttendanceMode, false);

    // Mặc định bật camera điểm danh
    initAttendanceCamera();

    // Kiểm tra kết nối 2 máy chủ
    checkServicesHealth();
    setInterval(checkServicesHealth, 8000);

    // Tải dữ liệu ban đầu
    loadPeopleList();
    loadAttendanceHistory();
});

function updateLiveClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("vi-VN", { hour12: false });
    const clockEl = document.getElementById("live-clock");
    if (clockEl) clockEl.textContent = timeStr;
}

function switchTab(tabName) {
    // RÀNG BUỘC PHÂN QUYỀN: Nhân viên CHỈ ĐƯỢC QUÉT MẶT (Tab Điểm danh)
    if (currentRole === "employee" && tabName !== "attendance") {
        showToast("Vai trò Nhân Viên chỉ được quyền quét mặt điểm danh! Chức năng này dành cho Quản Lý.", "warning");
        return;
    }

    // Ẩn tất cả tabs
    document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".nav-tab").forEach(el => el.classList.remove("active"));

    // Kích hoạt tab được chọn
    const targetTab = document.getElementById(`tab-${tabName}`);
    const targetBtn = document.getElementById(`tab-btn-${tabName}`);
    if (targetTab) targetTab.classList.add("active");
    if (targetBtn) targetBtn.classList.add("active");

    // Xử lý camera khi đổi tab
    if (tabName === "attendance") {
        initAttendanceCamera();
        loadAttendanceHistory();
    } else if (tabName === "register") {
        initRegisterCamera();
    } else if (tabName === "management") {
        loadPeopleList();
        loadAttendanceHistory();
    }
}

// ===================================================================
// 👑 QUẢN LÝ PHÂN QUYỀN (QUẢN LÝ vs NHÂN VIÊN)
// ===================================================================
function initRoleSystem() {
    applyRoleUI(currentRole);
}

function applyRoleUI(role) {
    currentRole = role;
    localStorage.setItem("face_attendance_role", role);

    const body = document.body;
    const roleIcon = document.getElementById("role-icon");
    const roleNameText = document.getElementById("role-name-text");
    const btnSwitchText = document.getElementById("btn-switch-role-text");
    const roleBanner = document.getElementById("role-banner");
    const roleBannerIcon = document.getElementById("role-banner-icon");
    const roleBannerTitle = document.getElementById("role-banner-title");
    const roleBannerDesc = document.getElementById("role-banner-desc");
    const roleBannerRight = document.getElementById("role-banner-right");

    if (role === "employee") {
        body.classList.add("role-employee");
        body.classList.remove("role-manager");

        if (roleIcon) roleIcon.className = "fa-solid fa-user";
        if (roleNameText) roleNameText.textContent = "Nhân Viên";
        if (btnSwitchText) btnSwitchText.textContent = "Đổi sang Quản Lý";

        if (roleBanner) {
            roleBanner.className = "role-banner banner-employee";
            if (roleBannerIcon) roleBannerIcon.className = "fa-solid fa-user-clock";
            if (roleBannerTitle) roleBannerTitle.textContent = "CHẾ ĐỘ NHÂN VIÊN (CHỈ QUÉT MẶT ĐIỂM DANH)";
            if (roleBannerDesc) roleBannerDesc.textContent = "Giao diện tối giản dành cho nhân viên điểm danh Check-in & Check-out. Các chức năng quản trị đã được ẩn.";
            if (roleBannerRight) roleBannerRight.innerHTML = '<span class="tag-role-privilege"><i class="fa-solid fa-camera"></i> Chỉ Quét Mặt</span>';
        }

        // Tự động chuyển về tab Điểm danh nếu đang ở tab quản trị
        switchTab("attendance");

    } else {
        body.classList.remove("role-employee");
        body.classList.add("role-manager");

        if (roleIcon) roleIcon.className = "fa-solid fa-shield-halved";
        if (roleNameText) roleNameText.textContent = "Quản Lý";
        if (btnSwitchText) btnSwitchText.textContent = "Đổi sang Nhân Viên";

        if (roleBanner) {
            roleBanner.className = "role-banner banner-manager";
            if (roleBannerIcon) roleBannerIcon.className = "fa-solid fa-shield-halved";
            if (roleBannerTitle) roleBannerTitle.textContent = "CHẾ ĐỘ QUẢN LÝ (TOÀN QUYỀN HỆ THỐNG)";
            if (roleBannerDesc) roleBannerDesc.textContent = "Bạn có tất cả các quyền: Điểm danh (Check-in/Check-out), Đăng ký khuôn mặt mới, Quản lý nhân sự và Nhật ký điểm danh.";
            if (roleBannerRight) roleBannerRight.innerHTML = '<span class="tag-role-privilege"><i class="fa-solid fa-unlock-keyhole"></i> Đầy đủ quyền quản trị</span>';
        }
    }
}

function handleRoleSwitchClick() {
    if (currentRole === "manager") {
        // Chuyển từ Quản lý sang Nhân viên
        applyRoleUI("employee");
        showToast("Đã chuyển sang chế độ Nhân Viên (Tối giản: chỉ quét mặt).", "info");
    } else {
        // Chuyển từ Nhân viên sang Quản lý -> Mở modal nhập PIN
        openPinModal();
    }
}

function openPinModal() {
    const modal = document.getElementById("pin-modal");
    const input = document.getElementById("manager-pin-input");
    const errorAlert = document.getElementById("pin-error-alert");

    if (modal) modal.style.display = "flex";
    if (errorAlert) errorAlert.style.display = "none";
    if (input) {
        input.value = "";
        setTimeout(() => input.focus(), 100);
    }
}

function closePinModal() {
    const modal = document.getElementById("pin-modal");
    if (modal) modal.style.display = "none";
}

function submitManagerPin() {
    const input = document.getElementById("manager-pin-input");
    const errorAlert = document.getElementById("pin-error-alert");
    const pin = input ? input.value.trim() : "";

    // Mã PIN quản lý mặc định: 123456 hoặc admin
    if (pin === "123456" || pin.toLowerCase() === "admin") {
        closePinModal();
        applyRoleUI("manager");
        showToast("Xác thực Quản Lý thành công! Đã mở khóa toàn bộ quyền.", "success");
        playSuccessChime();
    } else {
        if (errorAlert) {
            errorAlert.style.display = "flex";
            errorAlert.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Mã PIN không đúng! Gợi ý mã mặc định: <b>123456</b>';
        }
        playErrorSound();
        if (input) {
            input.value = "";
            input.focus();
        }
    }
}

// ===================================================================
// ⏱️ CHỌN KIỂU ĐIỂM DANH: GIỜ CHECK-IN & GIỜ CHECK-OUT
// ===================================================================
function selectAttendanceMode(mode, showNotification = true) {
    currentAttendanceMode = mode;
    localStorage.setItem("face_attendance_mode", mode);

    const btnCheckin = document.getElementById("btn-mode-checkin");
    const btnCheckout = document.getElementById("btn-mode-checkout");
    const hudPill = document.getElementById("hud-mode-pill");

    if (mode === "Check-in") {
        if (btnCheckin) btnCheckin.classList.add("active");
        if (btnCheckout) btnCheckout.classList.remove("active");
        if (hudPill) {
            hudPill.textContent = "CHECK-IN";
            hudPill.className = "current-mode-badge";
        }
    } else {
        if (btnCheckin) btnCheckin.classList.remove("active");
        if (btnCheckout) btnCheckout.classList.add("active");
        if (hudPill) {
            hudPill.textContent = "CHECK-OUT";
            hudPill.className = "current-mode-badge badge-checkout";
        }
    }

    if (showNotification) {
        playBeepSound(520, 80);
        showToast(`Đã chọn chế độ: Giờ ${mode}`, "info");
    }
}

// ===================================================================
// 2. QUẢN LÝ WEBCAM (HTML5 WebRTC)
// ===================================================================
async function initAttendanceCamera() {
    const video = document.getElementById("attendance-video");
    const offlineMask = document.getElementById("attendance-cam-offline");

    if (attendanceStream && attendanceStream.active) {
        if (offlineMask) offlineMask.style.display = "none";
        return;
    }

    try {
        attendanceStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 960 }, height: { ideal: 540 } },
            audio: false
        });
        video.srcObject = attendanceStream;
        if (offlineMask) offlineMask.style.display = "none";
    } catch (err) {
        console.warn("Không thể mở camera điểm danh:", err);
        if (offlineMask) offlineMask.style.display = "flex";
    }
}

function toggleAttendanceCam() {
    const video = document.getElementById("attendance-video");
    const offlineMask = document.getElementById("attendance-cam-offline");

    if (attendanceStream) {
        attendanceStream.getTracks().forEach(track => track.stop());
        attendanceStream = null;
        video.srcObject = null;
        if (offlineMask) offlineMask.style.display = "flex";
        showToast("Đã tắt Camera điểm danh.", "info");
    } else {
        initAttendanceCamera();
    }
}

async function initRegisterCamera() {
    const video = document.getElementById("register-video");
    const offlineMask = document.getElementById("register-cam-offline");
    const offlineText = document.getElementById("register-cam-offline-text");

    if (registerStream && registerStream.active) {
        if (offlineMask) offlineMask.style.display = "none";
        return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (offlineMask) offlineMask.style.display = "flex";
        if (offlineText) {
            offlineText.innerHTML = "Trình duyệt chặn WebRTC qua HTTP nội bộ.<br>👉 <b>Hãy bấm nút 'Chụp Bằng Camera Điện Thoại' bên dưới</b> để chụp trực tiếp!";
        }
        return;
    }

    try {
        registerStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 960 }, height: { ideal: 540 } },
            audio: false
        });
        video.srcObject = registerStream;
        if (offlineMask) offlineMask.style.display = "none";
    } catch (err) {
        console.warn("Không thể mở camera đăng ký:", err);
        if (offlineMask) offlineMask.style.display = "flex";
        if (offlineText) {
            offlineText.innerHTML = "Không thể mở webcam trực tiếp.<br>👉 <b>Bấm 'Chụp Bằng Camera Điện Thoại' bên dưới</b> để chụp selfie đăng ký!";
        }
    }
}

// ===================================================================
// 3. MÀN HÌNH ĐĂNG KÝ (SNAPSHOT & CHỐNG TRÙNG LẶP KHUÔN MẶT)
// ===================================================================
async function takeSnapshot() {
    const video = document.getElementById("register-video");
    const canvas = document.getElementById("register-canvas");
    const previewOverlay = document.getElementById("snapshot-preview-overlay");
    const previewImg = document.getElementById("snapshot-preview-img");
    const btnRetake = document.getElementById("btn-retake");
    const btnTake = document.getElementById("btn-take-snapshot");

    if (!video || !video.videoWidth) {
        showToast("Camera chưa sẵn sàng, vui lòng đợi bật camera!", "warning");
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Chuyển sang chuỗi Base64 JPEG chất lượng cao
    currentSnapshotBase64 = canvas.toDataURL("image/jpeg", 0.92);

    // Hiển thị ảnh chụp xem trước
    previewImg.src = currentSnapshotBase64;
    previewOverlay.style.display = "flex";

    btnRetake.style.display = "inline-flex";
    btnTake.style.display = "none";

    playBeepSound(600, 100);

    // KIỂM TRA TRÙNG LẶP KHUÔN MẶT NGAY TỨC THÌ
    await verifyFaceSnapshot(currentSnapshotBase64);
}

function retakeSnapshot() {
    const previewOverlay = document.getElementById("snapshot-preview-overlay");
    const statusBox = document.getElementById("snapshot-status-box");
    const dupCard = document.getElementById("duplicate-alert-card");
    const btnRetake = document.getElementById("btn-retake");
    const btnTake = document.getElementById("btn-take-snapshot");
    const submitBtn = document.getElementById("btn-submit-register");

    currentSnapshotBase64 = null;
    if (previewOverlay) previewOverlay.style.display = "none";
    if (dupCard) dupCard.style.display = "none";

    if (statusBox) {
        statusBox.style.display = "flex";
        statusBox.className = "snapshot-status-box";
        statusBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <span>Chưa chụp ảnh khuôn mặt! Vui lòng bấm <b>Chụp Khuôn Mặt</b> trước khi đăng ký.</span>';
    }

    if (btnRetake) btnRetake.style.display = "none";
    if (btnTake) btnTake.style.display = "inline-flex";
    if (submitBtn) submitBtn.disabled = false;
    const fileInput = document.getElementById("input-file-face");
    if (fileInput) fileInput.value = "";
}

function handleFaceFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showToast("Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG)!", "warning");
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        currentSnapshotBase64 = e.target.result;

        const previewOverlay = document.getElementById("snapshot-preview-overlay");
        const previewImg = document.getElementById("snapshot-preview-img");
        const btnRetake = document.getElementById("btn-retake");
        const btnTake = document.getElementById("btn-take-snapshot");

        if (previewImg) previewImg.src = currentSnapshotBase64;
        if (previewOverlay) previewOverlay.style.display = "flex";

        if (btnRetake) btnRetake.style.display = "inline-flex";
        if (btnTake) btnTake.style.display = "none";

        // KIỂM TRA TRÙNG LẶP KHUÔN MẶT NGAY KHI TẢI ẢNH LÊN
        await verifyFaceSnapshot(currentSnapshotBase64);
    };
    reader.readAsDataURL(file);
}

// Hàm kiểm tra sinh trắc học và trùng lặp khuôn mặt ngay khi có ảnh
async function verifyFaceSnapshot(base64Image) {
    const statusBox = document.getElementById("snapshot-status-box");
    const dupCard = document.getElementById("duplicate-alert-card");
    const dupMsg = document.getElementById("dup-alert-msg");
    const submitBtn = document.getElementById("btn-submit-register");

    if (statusBox) {
        statusBox.style.display = "flex";
        statusBox.className = "snapshot-status-box";
        statusBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang phân tích định vị 5 điểm mốc & kiểm tra CSDL khuôn mặt...</span>';
    }
    if (dupCard) dupCard.style.display = "none";
    if (submitBtn) submitBtn.disabled = true;

    try {
        const response = await fetch(`${CONFIG.AI_API_URL}/api/ai/verify-face`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64Image })
        });

        const result = await response.json();

        // 1. Không phát hiện được khuôn mặt
        if (!result.success || !result.faceFound) {
            if (statusBox) {
                statusBox.style.display = "flex";
                statusBox.className = "snapshot-status-box";
                statusBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> <span>Không phát hiện khuôn mặt nào! Vui lòng nhìn thẳng, đủ sáng và bấm Chụp Lại.</span>';
            }
            showToast("Không tìm thấy khuôn mặt rõ ràng trong ảnh! Vui lòng chụp lại.", "warning");
            playErrorSound();
            if (submitBtn) submitBtn.disabled = true;
            return false;
        }

        // 2. CẢNH BÁO: ĐÃ ĐĂNG KÝ KHUÔN MẶT RỒI -> BẮT CHỤP LẠI, KHÔNG THÊM VÀO DATA
        if (result.isDuplicate) {
            playErrorSound();
            if (statusBox) statusBox.style.display = "none";
            if (dupCard) {
                dupCard.style.display = "flex";
                if (dupMsg) {
                    dupMsg.innerHTML = `Khuôn mặt này <b>đã đăng kí khuôn mặt rồi</b> (Trùng khớp với nhân viên: <strong style="color: #ff4d79; font-size: 15px;">${escapeHtml(result.matchedName || "")}</strong> - Độ khớp: <b>${result.confidence}%</b>).<br><span style="color: #cbd5e1;">👉 Bắt buộc phải chụp lại khuôn mặt khác. Hệ thống tuyệt đối không thêm vào data!</span>`;
                }
            }
            showToast(`⚠️ ĐÃ ĐĂNG KÍ KHUÔN MẶT RỒI! Trùng khớp với ${result.matchedName}. Bắt buộc chụp lại!`, "danger");

            // Khóa nút Submit, buộc người dùng phải chụp lại
            if (submitBtn) submitBtn.disabled = true;
            return false;
        }

        // 3. KHUÔN MẶT HỢP LỆ (MỚI HOÀN TOÀN)
        if (dupCard) dupCard.style.display = "none";
        if (statusBox) {
            statusBox.style.display = "flex";
            statusBox.className = "snapshot-status-box ready";
            statusBox.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>Khuôn mặt hợp lệ (Chưa từng đăng ký) - Sẵn sàng gửi lưu vào hệ thống!</span>';
        }
        if (submitBtn) submitBtn.disabled = false;
        return true;

    } catch (err) {
        console.warn("Kiểm tra sơ bộ khuôn mặt thất bại (máy chủ AI có thể chưa online):", err);
        if (statusBox) {
            statusBox.style.display = "flex";
            statusBox.className = "snapshot-status-box ready";
            statusBox.innerHTML = '<i class="fa-solid fa-circle-check"></i> <span>Đã chụp ảnh. Bấm nút bên dưới để gửi đăng ký.</span>';
        }
        if (submitBtn) submitBtn.disabled = false;
        return true;
    }
}

async function handleRegisterSubmit(event) {
    event.preventDefault();

    const code = document.getElementById("reg-code").value.trim();
    const name = document.getElementById("reg-name").value.trim();
    const dept = document.getElementById("reg-dept").value;
    const submitBtn = document.getElementById("btn-submit-register");

    if (!name) {
        showToast("Vui lòng nhập họ và tên nhân viên!", "warning");
        return;
    }

    if (!currentSnapshotBase64) {
        showToast("Vui lòng chụp ảnh khuôn mặt trước khi gửi đăng ký!", "warning");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ĐANG TRÍCH XUẤT VECTOR AI & LƯU...';

    try {
        // Gửi ảnh sang Python AI Service để trích xuất 128D và lưu Database
        const response = await fetch(`${CONFIG.AI_API_URL}/api/ai/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                code: code,
                name: name,
                dept: dept,
                image: currentSnapshotBase64
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showToast(` Đăng ký thành công: ${name} (Mã: ${code})!`, "success");
            playSuccessChime();

            // Reset form
            document.getElementById("register-form").reset();
            retakeSnapshot();

            // Tải lại danh sách bên Quản lý
            loadPeopleList();
        } else {
            // NẾU PHÁT HIỆN TRÙNG LẶP KHUÔN MẶT
            if (result.isDuplicate) {
                const dupCard = document.getElementById("duplicate-alert-card");
                const dupMsg = document.getElementById("dup-alert-msg");
                const statusBox = document.getElementById("snapshot-status-box");

                if (statusBox) statusBox.style.display = "none";
                if (dupCard) {
                    dupCard.style.display = "flex";
                    if (dupMsg) {
                        dupMsg.innerHTML = `Khuôn mặt này <b>đã đăng kí khuôn mặt rồi</b> (Trùng khớp với: <strong style="color: #ff4d79;">${escapeHtml(result.matchedName || "")}</strong> - Độ khớp: <b>${result.confidence}%</b>)!<br><span style="color: #cbd5e1;">👉 Bắt buộc phải chụp lại khuôn mặt khác. Hệ thống không thêm vào data!</span>`;
                    }
                }
                showToast(`⚠️ ĐÃ ĐĂNG KÍ KHUÔN MẶT RỒI! Không thêm vào data, vui lòng chụp lại!`, "danger");
                retakeSnapshot();
            } else {
                showToast(result.message || "Đăng ký thất bại. Vui lòng thử lại!", "danger");
            }
            playErrorSound();
        }
    } catch (err) {
        console.error("Lỗi đăng ký:", err);
        showToast(`Không thể kết nối Python AI Server (${CONFIG.AI_API_URL})! Hãy chắc chắn bạn đã chạy ai_service.py.`, "danger");
        playErrorSound();
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> GỬI LÊN PYTHON AI & LƯU DATABASE';
    }
}

// ===================================================================
// 4. MÀN HÌNH ĐIỂM DANH (SCAN & RECOGNIZE & LOG TO C# BACKEND)
// ===================================================================
// Biến quản lý trạng thái lượt quét & chống đè kết quả người cũ
let scanSequence = 0;
let lastRecognizedPerson = { name: "", time: 0 };
let resetResultCardTimer = null;

async function performFaceScan() {
    if (isScanning) return;

    const video = document.getElementById("attendance-video");
    const canvas = document.getElementById("attendance-canvas");

    if (!video || !video.videoWidth) {
        showToast("Camera điểm danh chưa bật hoặc chưa sẵn sàng! Bạn có thể dùng nút 'Chụp Bằng Điện Thoại'.", "warning");
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const frameBase64 = canvas.toDataURL("image/jpeg", 0.90);
    await recognizeFrame(frameBase64);
}

async function handleAttendanceFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        const frameBase64 = e.target.result;
        await recognizeFrame(frameBase64);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
}

async function recognizeFrame(frameBase64) {
    if (isScanning) return;

    const hud = document.getElementById("hud-overlay");
    const targetBox = document.getElementById("hud-target-box");
    const targetLabel = document.getElementById("hud-target-label");

    const currentSeq = ++scanSequence;
    isScanning = true;
    if (hud) hud.classList.add("scanning");
    if (targetLabel) targetLabel.textContent = "SCANNING...";

    // 1. NGAY LẬP TỨC XÓA TÊN NGƯỜI CŨ (để người mới không bao giờ thấy tên người trước)
    updateResultCardProcessing();

    try {
        // 2. Gửi ảnh sang Python AI Service kèm kiểu điểm danh (Check-in hoặc Check-out)
        const response = await fetch(`${CONFIG.AI_API_URL}/api/ai/recognize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                image: frameBase64,
                type: currentAttendanceMode
            })
        });

        // Nếu trong lúc chờ đã có lượt quét mới hơn, bỏ qua kết quả trễ này
        if (currentSeq !== scanSequence) {
            return;
        }

        const result = await response.json();

        if (result.success && result.isMatched) {
            // Nhận diện thành công
            if (targetBox) targetBox.className = "hud-target-box matched";
            if (targetLabel) targetLabel.textContent = `${currentAttendanceMode.toUpperCase()}: ${result.name.toUpperCase()}`;

            const nowTs = Date.now();
            const now = new Date();
            const timeStr = now.toLocaleTimeString("vi-VN", { hour12: false });

            // Kiểm tra chống spam điểm danh & giọng nói cho cùng 1 người trong 4 giây
            const isSamePersonRecent = (lastRecognizedPerson.name === result.name && (nowTs - lastRecognizedPerson.time < 4000));

            if (!isSamePersonRecent) {
                lastRecognizedPerson = { name: result.name, time: nowTs };
                playSuccessChime();
                speakWelcome(result.name, currentAttendanceMode);
                recordAttendanceToBackend(result.personId, result.name, result.confidence, currentAttendanceMode);
                loadAttendanceHistory();
            }

            // Cập nhật thẻ kết quả người này
            updateResultCard({
                isSuccess: true,
                mode: currentAttendanceMode,
                name: result.name,
                msg: `Điểm danh ${currentAttendanceMode} thành công! Độ khớp: ${result.confidence}% (Cosine: ${result.cosine})`,
                time: timeStr,
                confidence: `${result.confidence}%`,
                id: result.personId || "--"
            });

            // 3. TỰ ĐỘNG RESET VỀ "SẴN SÀNG" SAU 3.5 GIÂY ĐỂ NGƯỜI TIẾP THEO BƯỚC VÀO
            if (resetResultCardTimer) clearTimeout(resetResultCardTimer);
            resetResultCardTimer = setTimeout(() => {
                resetResultCardToReady();
            }, 3500);

        } else if (result.faceFound === false) {
            // Không phát hiện khuôn mặt nào trong khung hình
            if (targetBox) targetBox.className = "hud-target-box";
            if (targetLabel) targetLabel.textContent = "NO FACE DETECTED";

            if (!autoScanInterval) {
                // Chỉ hiện thông báo nhắc nhở khi người dùng bấm thủ công
                updateResultCard({
                    statusType: "info",
                    mode: currentAttendanceMode,
                    name: "Chưa thấy khuôn mặt",
                    msg: "Vui lòng đứng thẳng, nhìn vào camera và đảm bảo đủ ánh sáng.",
                    time: "--:--:--",
                    confidence: "0%",
                    id: "--"
                });
            } else {
                // Tự động quét: nếu không có ai trước camera thì để ở trạng thái SẴN SÀNG
                resetResultCardToReady();
            }

        } else {
            // Có khuôn mặt nhưng KHÔNG KHỚP với bất kỳ ai trong CSDL (Người lạ)
            if (targetBox) targetBox.className = "hud-target-box unmatched";
            if (targetLabel) targetLabel.textContent = "UNKNOWN FACE";
            
            if (!autoScanInterval) {
                playErrorSound();
            }

            updateResultCard({
                statusType: "danger",
                mode: currentAttendanceMode,
                name: "Người lạ / Unknown",
                msg: "Khuôn mặt chưa được đăng ký trong hệ thống!",
                time: "--:--:--",
                confidence: `${result.confidence || 0}%`,
                id: "N/A"
            });

            // Tự động reset về trạng thái chờ sau 2.5 giây
            if (resetResultCardTimer) clearTimeout(resetResultCardTimer);
            resetResultCardTimer = setTimeout(() => {
                resetResultCardToReady();
            }, 2500);
        }
    } catch (err) {
        console.error("Lỗi quét điểm danh:", err);
        if (targetBox) targetBox.className = "hud-target-box unmatched";
        if (targetLabel) targetLabel.textContent = "SERVER ERROR";
        updateResultCard({
            statusType: "danger",
            mode: currentAttendanceMode,
            name: "Lỗi kết nối",
            msg: `Không kết nối được Python AI (${CONFIG.AI_API_URL})!`,
            time: "--:--:--",
            confidence: "0%",
            id: "--"
        });
    } finally {
        if (hud) hud.classList.remove("scanning");
        if (!autoScanInterval && targetLabel && targetLabel.textContent === "SCANNING...") {
            if (targetBox) targetBox.className = "hud-target-box";
            targetLabel.textContent = "READY";
        }
        isScanning = false;
    }
}

function updateResultCardProcessing() {
    const card = document.getElementById("result-card");
    const badge = document.getElementById("result-status-badge");
    const nameEl = document.getElementById("result-name");
    const msgEl = document.getElementById("result-msg");
    const metrics = document.getElementById("result-metrics");

    if (card) card.className = "result-card";
    if (badge) {
        badge.className = "result-badge badge-idle";
        badge.textContent = `ĐANG XỬ LÝ (${currentAttendanceMode.toUpperCase()})...`;
    }
    if (nameEl) nameEl.textContent = "Đang nhận diện khuôn mặt...";
    if (msgEl) msgEl.textContent = "Vui lòng nhìn thẳng vào camera...";
    if (metrics) metrics.style.display = "none";
}

function resetResultCardToReady() {
    const card = document.getElementById("result-card");
    const badge = document.getElementById("result-status-badge");
    const nameEl = document.getElementById("result-name");
    const msgEl = document.getElementById("result-msg");
    const metrics = document.getElementById("result-metrics");
    const targetBox = document.getElementById("hud-target-box");
    const targetLabel = document.getElementById("hud-target-label");

    if (card) card.className = "result-card";
    if (badge) {
        badge.className = "result-badge badge-idle";
        badge.textContent = `SẴN SÀNG (${currentAttendanceMode.toUpperCase()})`;
    }
    if (nameEl) nameEl.textContent = `Sẵn sàng điểm danh ${currentAttendanceMode}`;
    if (msgEl) msgEl.textContent = "Mời người tiếp theo bước vào khung hình camera";
    if (metrics) metrics.style.display = "none";
    if (targetBox) targetBox.className = "hud-target-box";
    if (targetLabel) targetLabel.textContent = "READY";
}

function toggleAutoScan(enabled) {
    if (enabled) {
        showToast("Đã bật chế độ Tự Động Quét Điểm Danh (mỗi 1.5 giây).", "info");
        performFaceScan();
        autoScanInterval = setInterval(() => {
            if (!isScanning) performFaceScan();
        }, 1500);
    } else {
        if (autoScanInterval) {
            clearInterval(autoScanInterval);
            autoScanInterval = null;
        }
        showToast("Đã tắt chế độ Tự Động Quét.", "info");
    }
}

function updateResultCard({ isSuccess, statusType, mode, name, msg, time, confidence, id }) {
    const card = document.getElementById("result-card");
    const badge = document.getElementById("result-status-badge");
    const nameEl = document.getElementById("result-name");
    const msgEl = document.getElementById("result-msg");
    const metrics = document.getElementById("result-metrics");
    const timeLabel = document.getElementById("res-time-label");
    const timeEl = document.getElementById("res-time");
    const typeEl = document.getElementById("res-type");
    const confEl = document.getElementById("res-confidence");
    const idEl = document.getElementById("res-id");

    const attMode = mode || currentAttendanceMode;
    const type = statusType || (isSuccess === true ? "success" : isSuccess === false ? "danger" : "info");

    if (type === "success") {
        card.className = "result-card success-border";
        badge.className = attMode === "Check-out" ? "result-badge badge-checkout" : "result-badge badge-success";
        badge.textContent = `${attMode.toUpperCase()} THÀNH CÔNG`;
        metrics.style.display = "flex";
        if (timeLabel) timeLabel.textContent = `Giờ ${attMode}:`;
        if (typeEl) typeEl.textContent = attMode;
    } else if (type === "danger") {
        card.className = "result-card danger-border";
        badge.className = "result-badge badge-danger";
        badge.textContent = "CHƯA ĐĂNG KÝ";
        metrics.style.display = "flex";
        if (timeLabel) timeLabel.textContent = "Giờ:";
        if (typeEl) typeEl.textContent = attMode;
    } else {
        card.className = "result-card";
        badge.className = "result-badge badge-idle";
        badge.textContent = "THÔNG BÁO";
        metrics.style.display = "none";
    }

    if (nameEl) nameEl.textContent = name;
    if (msgEl) msgEl.textContent = msg;
    if (timeEl) timeEl.textContent = time;
    if (confEl) confEl.textContent = confidence;
    if (idEl) idEl.textContent = id;
}

// Gửi ghi nhận điểm danh sang C# Backend
async function recordAttendanceToBackend(personId, personName, confidence, status) {
    const attType = status || currentAttendanceMode;
    try {
        await fetch(`${CONFIG.BACKEND_URL}/api/attendance/checkin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                personId: personId,
                personName: personName,
                confidence: confidence,
                status: attType,
                type: attType
            })
        });
    } catch (err) {
        console.warn("Không thể gửi checkin sang C# Backend:", err);
    }
}

let attendanceHistoryData = [];

// Hàm render badge Check-in vs Check-out
function renderAttendanceTypeBadge(type) {
    const isCheckOut = (type || "").toLowerCase().includes("checkout") || (type || "").toLowerCase().includes("check-out");
    if (isCheckOut) {
        return `<span class="badge-checkout"><i class="fa-solid fa-arrow-right-from-bracket"></i> Check-out</span>`;
    }
    return `<span class="badge-checkin"><i class="fa-solid fa-arrow-right-to-bracket"></i> Check-in</span>`;
}

// Lấy lịch sử điểm danh từ C# Backend (Fallback sang Python AI SQLite nếu C# bận)
async function loadAttendanceHistory() {
    const tbodyMini = document.getElementById("attendance-history-tbody");
    const tbodyFull = document.getElementById("full-history-tbody");
    const statToday = document.getElementById("stat-today-attendance");

    let list = null;

    // 1. Thử lấy từ C# Backend
    try {
        const res = await fetch(`${CONFIG.BACKEND_URL}/api/attendance/history?limit=100`);
        if (res.ok) {
            list = await res.json();
        }
    } catch (err) {
        // C# Backend chưa sẵn sàng, chuyển sang fallback
    }

    // 2. Fallback trực tiếp sang Python AI Service (đọc thẳng SQLite)
    if (!list || list.length === 0) {
        try {
            const resAi = await fetch(`${CONFIG.AI_API_URL}/api/ai/history?limit=100`);
            if (resAi.ok) {
                list = await resAi.json();
            }
        } catch (err) {}
    }

    if (!list || list.length === 0) {
        if (tbodyMini) tbodyMini.innerHTML = '<tr><td colspan="6" class="text-center empty-state">Chưa có lượt điểm danh nào trong CSDL.</td></tr>';
        if (tbodyFull) tbodyFull.innerHTML = '<tr><td colspan="7" class="text-center empty-state">Chưa có dữ liệu điểm danh nào trong CSDL SQLite.</td></tr>';
        if (statToday) statToday.textContent = 0;
        return;
    }

    attendanceHistoryData = list;

    // 3. Hiển thị ở Tab 1 (Bảng nhỏ 10 dòng gần nhất bên cạnh camera)
    if (tbodyMini) {
        tbodyMini.innerHTML = list.slice(0, 10).map(item => `
            <tr>
                <td><strong>${escapeHtml(item.personName)}</strong></td>
                <td>${renderAttendanceTypeBadge(item.type || item.status)}</td>
                <td><span class="font-mono">${item.time || "--:--:--"}</span></td>
                <td>${item.date || ""}</td>
                <td><span class="tag-success">${item.confidence}%</span></td>
                <td><span class="badge-success" style="padding: 2px 8px; border-radius: 4px; font-size: 11px;">Hợp lệ</span></td>
            </tr>
        `).join("");
    }

    // 4. Hiển thị ở Tab 3 (Bảng chi tiết toàn bộ lịch sử)
    renderFullHistoryTable(attendanceHistoryData);

    // 5. Cập nhật thống kê
    if (statToday) statToday.textContent = list.length;
}

function renderFullHistoryTable(list) {
    const tbodyFull = document.getElementById("full-history-tbody");
    if (!tbodyFull) return;

    if (!list || list.length === 0) {
        tbodyFull.innerHTML = '<tr><td colspan="7" class="text-center empty-state">Không tìm thấy lượt điểm danh nào phù hợp.</td></tr>';
        return;
    }

    tbodyFull.innerHTML = list.map((item, index) => `
        <tr>
            <td><strong>#${index + 1}</strong></td>
            <td><strong style="font-size: 14px;">${escapeHtml(item.personName)}</strong></td>
            <td>${renderAttendanceTypeBadge(item.type || item.status)}</td>
            <td><span class="font-mono" style="color: var(--primary); font-weight: 600;">${item.time || "--:--:--"}</span></td>
            <td>${item.date || ""}</td>
            <td><span class="tag-success">${item.confidence}%</span></td>
            <td><span class="badge-success" style="padding: 3px 10px; border-radius: 9999px; font-size: 11px;"><i class="fa-solid fa-check"></i> Hợp lệ</span></td>
        </tr>
    `).join("");
}

function filterHistoryTable() {
    const input = document.getElementById("history-search-input");
    const query = input ? input.value.toLowerCase().trim() : "";
    if (!query) {
        renderFullHistoryTable(attendanceHistoryData);
        return;
    }

    const filtered = attendanceHistoryData.filter(item => 
        (item.personName && item.personName.toLowerCase().includes(query)) ||
        (item.date && item.date.includes(query)) ||
        (item.time && item.time.includes(query))
    );
    renderFullHistoryTable(filtered);
}

// ===================================================================
// 5. MÀN HÌNH QUẢN LÝ NHÂN SỰ (CSDL SQLITE QUA C# BACKEND)
// ===================================================================
async function loadPeopleList() {
    const tbody = document.getElementById("people-table-tbody");
    const countPill = document.getElementById("people-count-pill");
    const statTotal = document.getElementById("stat-total-people");
    const statVector = document.getElementById("stat-vector-people");

    try {
        // Lấy danh sách trực tiếp từ C# Backend
        const res = await fetch(`${CONFIG.BACKEND_URL}/api/people`);
        if (!res.ok) throw new Error("Backend response not ok");

        const people = await res.json();
        peopleDatabase = people;

        countPill.textContent = people.length;
        if (statTotal) statTotal.textContent = people.length;
        if (statVector) statVector.textContent = people.filter(p => p.faceVectorJson && p.faceVectorJson.length > 50).length;

        renderPeopleTable(people);

    } catch (err) {
        console.warn("Không thể tải từ C# Backend:", err);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center empty-state" style="color: var(--danger);">
                    ⚠️ Chưa kết nối được với C# Backend (${CONFIG.BACKEND_URL}). Hãy đảm bảo bạn đã khởi động Backend!
                </td>
            </tr>
        `;
    }
}

function renderPeopleTable(list) {
    const tbody = document.getElementById("people-table-tbody");

    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center empty-state">Cơ sở dữ liệu SQLite chưa có nhân viên nào. Hãy qua tab Đăng Ký để thêm!</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(person => {
        const hasVector = person.faceVectorJson && person.faceVectorJson.length > 50;
        const vecPreview = hasVector ? person.faceVectorJson.substring(0, 32) + "..." : "Trống";

        return `
            <tr>
                <td><strong>#${person.id}</strong></td>
                <td>
                    <div class="user-avatar-thumb">
                        <i class="fa-solid fa-user"></i>
                    </div>
                </td>
                <td><strong style="font-size: 15px;">${escapeHtml(person.name)}</strong></td>
                <td>
                    ${hasVector 
                        ? '<span class="badge-online" style="padding: 4px 10px; font-size: 11px; border-radius: 9999px;"><i class="fa-solid fa-check"></i> 128D Vector Chuẩn</span>' 
                        : '<span class="badge-offline" style="padding: 4px 10px; font-size: 11px; border-radius: 9999px;">Chưa có</span>'
                    }
                </td>
                <td><code class="vector-snippet" title="${escapeHtml(person.faceVectorJson)}">${vecPreview}</code></td>
                <td>
                    <button class="btn-icon-danger" title="Xóa nhân viên" onclick="deletePerson(${person.id}, '${escapeHtml(person.name)}')">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function filterPeopleTable() {
    const query = document.getElementById("search-input").value.toLowerCase().trim();
    if (!query) {
        renderPeopleTable(peopleDatabase);
        return;
    }

    const filtered = peopleDatabase.filter(p => 
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.id && p.id.toString().includes(query))
    );
    renderPeopleTable(filtered);
}

async function deletePerson(id, name) {
    if (!confirm(`Bạn có chắc chắn muốn xóa nhân viên "${name}" (ID: #${id}) khỏi cơ sở dữ liệu?`)) {
        return;
    }

    try {
        const res = await fetch(`${CONFIG.BACKEND_URL}/api/people/${id}`, {
            method: "DELETE"
        });

        if (res.ok) {
            showToast(`Đã xóa thành công nhân viên "${name}".`, "success");
            loadPeopleList();
        } else {
            showToast("Không thể xóa nhân viên này!", "danger");
        }
    } catch (err) {
        showToast("Lỗi kết nối khi xóa nhân viên!", "danger");
    }
}

// ===================================================================
// 6. HEALTH CHECK VÀ THÔNG BÁO HỆ THỐNG
// ===================================================================
async function checkServicesHealth() {
    // 1. Kiểm tra Python AI Service (Port 5001)
    const aiBadge = document.getElementById("ai-status-badge");
    const aiText = document.getElementById("ai-status-text");
    try {
        const res = await fetch(`${CONFIG.AI_API_URL}/api/ai/health`, { timeout: 2000 });
        if (res.ok) {
            aiBadge.className = "badge badge-online";
            aiText.textContent = "Online (5001)";
        } else {
            throw new Error();
        }
    } catch (e) {
        aiBadge.className = "badge badge-offline";
        aiText.textContent = "Offline (5001)";
    }

    // 2. Kiểm tra C# Backend: Tự động hỗ trợ cả Port 5286 (Kestrel) và Port 61642 (IIS Express)
    const beBadge = document.getElementById("backend-status-badge");
    const beText = document.getElementById("backend-status-text");
    
    let backendActive = false;
    const candidatePorts = [5286, 61642];

    for (const port of candidatePorts) {
        try {
            const testUrl = `http://localhost:${port}`;
            const res = await fetch(`${testUrl}/api/people`, { timeout: 1500 });
            if (res.ok) {
                CONFIG.BACKEND_URL = testUrl;
                beBadge.className = "badge badge-online";
                beText.textContent = `Online (${port === 61642 ? "IIS: " : ""}${port})`;
                backendActive = true;
                break;
            }
        } catch (e) {}
    }

    if (!backendActive) {
        beBadge.className = "badge badge-offline";
        beText.textContent = "Offline";
    }
}

function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let icon = "fa-circle-info";
    if (type === "success") icon = "fa-circle-check";
    if (type === "danger") icon = "fa-circle-xmark";
    if (type === "warning") icon = "fa-triangle-exclamation";

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(50px)";
        toast.style.transition = "all 0.3s ease";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ===================================================================
// 7. ÂM THANH VÀ GIỌNG NÓI TIẾNG VIỆT
// ===================================================================
function playSuccessChime() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5

        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
}

function playErrorSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(160, ctx.currentTime + 0.15);

        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

        osc.start();
        osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
}

function playBeepSound(freq = 440, duration = 100) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (duration / 1000));

        osc.start();
        osc.stop(ctx.currentTime + (duration / 1000));
    } catch (e) {}
}

function speakWelcome(name, mode = "Check-in") {
    if (!('speechSynthesis' in window)) return;
    try {
        // Rút gọn lấy tên chính (loại bỏ mã nhân viên như "NV-001 - Pham Giang" -> "Pham Giang")
        let cleanName = name;
        if (cleanName.includes("-")) {
            cleanName = cleanName.split("-").slice(1).join("-").trim();
        }

        const isCheckOut = (mode || "").toLowerCase().includes("checkout") || (mode || "").toLowerCase().includes("check-out");
        const greetingText = isCheckOut
            ? `Điểm danh Check out thành công! Tạm biệt ${cleanName}, hẹn gặp lại.`
            : `Điểm danh Check in thành công! Xin chào ${cleanName}.`;

        const utterance = new SpeechSynthesisUtterance(greetingText);
        utterance.lang = "vi-VN";
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    } catch (e) {}
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
