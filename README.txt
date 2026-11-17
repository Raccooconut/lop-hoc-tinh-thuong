# Quizzy Party - phiên bản 1.0

## Cần cài
- Node.js bản LTS: https://nodejs.org/
- Visual Studio Code (không bắt buộc nhưng khuyến khích): https://code.visualstudio.com/

## Chạy game
1. Giải nén thư mục `quizzy-party`.
2. Mở thư mục đó trong VS Code.
3. Mở Terminal > New Terminal.
4. Chạy lệnh: `npm install`
5. Sau khi cài xong, chạy: `npm start`
6. Mở trình duyệt tại: http://localhost:3000

## Chơi thử trên cùng Wi-Fi
- Máy quản trò chạy server.
- Tìm địa chỉ IPv4 của máy quản trò bằng lệnh `ipconfig` trên Windows.
- Người chơi cùng Wi-Fi mở `http://DIA-CHI-IP:3000` (thay DIA-CHI-IP bằng IPv4, ví dụ `192.168.1.10`).
- Nếu Windows Firewall hỏi, cho phép Node.js trên mạng Private.
- Quản trò tạo phòng, người chơi nhập mã PIN.

## Ghi chú
- Đây là bản thử nghiệm: câu hỏi mẫu được viết sẵn trong `server.js`.
- Dữ liệu phòng chỉ tồn tại khi máy chủ đang chạy; tắt server sẽ xóa phòng.
- Không đưa máy chủ này ra Internet công cộng khi chưa bổ sung bảo mật và giới hạn truy cập.
