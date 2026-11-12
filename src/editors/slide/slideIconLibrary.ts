import {
  Activity, AlarmClock, Award, Baby, BadgeCheck, Banknote, BarChart3, Battery, Bell, Bike, Book, BookOpen, Bot, Brain, Briefcase, Building2, Bus,
  Cake, Calculator, Calendar, Camera, Car, ChartLine, ChartPie, CheckCircle2, Cloud, CloudRain, Code2, Coffee, Coins, Compass, Cpu, CreditCard,
  Crown, Database, Diamond, DollarSign, Download, Droplet, Factory, FileText, Flag, Flame, FlaskConical, Folder, Gift, Globe, GraduationCap,
  Hammer, Handshake, HardHat, Headphones, Heart, HeartPulse, Home, Hospital, Hourglass, Key, Laptop, Leaf, Lightbulb, Link, Lock, Mail, Map,
  MapPin, Medal, Megaphone, MessageCircle, Mic, Monitor, Moon, Mountain, Music, Package, Paintbrush, Palette, PartyPopper, PenTool, Phone,
  PieChart, Plane, Plug, Puzzle, Rocket, Scale, School, Search, Send, Server, Settings, Shield, ShieldCheck, Ship, ShoppingCart, Smartphone,
  Smile, Sparkles, Star, Stethoscope, Store, Sun, Tablet, Tag, Target, Thermometer, ThumbsUp, Timer, Train, TreePine, TrendingDown, TrendingUp,
  Trophy, Truck, Umbrella, Upload, User, UserCheck, Users, Utensils, Video, Wallet, Wifi, Wind, Wrench, Zap, type LucideIcon,
} from 'lucide-react';

export interface SlideIconGroup {
  name: string;
  icons: ReadonlyArray<readonly [string, LucideIcon, string]>;
}

export const SLIDE_ICON_GROUPS: SlideIconGroup[] = [
  { name: 'Kinh doanh', icons: [['briefcase', Briefcase, 'cặp công việc'], ['handshake', Handshake, 'bắt tay hợp tác'], ['target', Target, 'mục tiêu'], ['trending-up', TrendingUp, 'tăng trưởng'], ['trending-down', TrendingDown, 'sụt giảm'], ['chart-line', ChartLine, 'biểu đồ đường'], ['bar-chart', BarChart3, 'biểu đồ cột'], ['pie-chart', PieChart, 'biểu đồ tròn'], ['chart-pie', ChartPie, 'tỷ trọng'], ['dollar', DollarSign, 'đô la'], ['banknote', Banknote, 'tiền mặt'], ['coins', Coins, 'đồng xu'], ['wallet', Wallet, 'ví tiền'], ['credit-card', CreditCard, 'thẻ'], ['store', Store, 'cửa hàng'], ['cart', ShoppingCart, 'giỏ hàng'], ['tag', Tag, 'giá'], ['megaphone', Megaphone, 'quảng bá'], ['award', Award, 'giải thưởng'], ['trophy', Trophy, 'cúp'], ['medal', Medal, 'huy chương'], ['crown', Crown, 'vương miện']] },
  { name: 'Con người', icons: [['user', User, 'người'], ['users', Users, 'nhóm'], ['user-check', UserCheck, 'đã duyệt'], ['baby', Baby, 'em bé'], ['smile', Smile, 'vui vẻ'], ['thumbs-up', ThumbsUp, 'thích'], ['heart', Heart, 'trái tim'], ['party', PartyPopper, 'chúc mừng'], ['graduation', GraduationCap, 'tốt nghiệp'], ['message', MessageCircle, 'tin nhắn'], ['hard-hat', HardHat, 'công nhân']] },
  { name: 'Công nghệ', icons: [['laptop', Laptop, 'máy tính'], ['monitor', Monitor, 'màn hình'], ['smartphone', Smartphone, 'điện thoại'], ['tablet', Tablet, 'máy tính bảng'], ['cpu', Cpu, 'chip'], ['server', Server, 'máy chủ'], ['database', Database, 'cơ sở dữ liệu'], ['cloud', Cloud, 'đám mây'], ['wifi', Wifi, 'mạng'], ['code', Code2, 'lập trình'], ['bot', Bot, 'robot AI'], ['brain', Brain, 'trí tuệ'], ['plug', Plug, 'kết nối'], ['battery', Battery, 'pin'], ['link', Link, 'liên kết'], ['lock', Lock, 'bảo mật'], ['shield', Shield, 'bảo vệ'], ['shield-check', ShieldCheck, 'an toàn'], ['key', Key, 'khóa'], ['settings', Settings, 'cài đặt'], ['search', Search, 'tìm kiếm'], ['download', Download, 'tải xuống'], ['upload', Upload, 'tải lên']] },
  { name: 'Giao tiếp', icons: [['mail', Mail, 'thư'], ['phone', Phone, 'điện thoại bàn'], ['send', Send, 'gửi'], ['bell', Bell, 'thông báo'], ['mic', Mic, 'micro'], ['headphones', Headphones, 'tai nghe'], ['video', Video, 'video'], ['camera', Camera, 'máy ảnh'], ['music', Music, 'âm nhạc'], ['calendar', Calendar, 'lịch'], ['clock', AlarmClock, 'đồng hồ'], ['timer', Timer, 'hẹn giờ'], ['hourglass', Hourglass, 'thời gian']] },
  { name: 'Giao thông & địa điểm', icons: [['car', Car, 'ô tô'], ['bus', Bus, 'xe buýt'], ['truck', Truck, 'xe tải'], ['train', Train, 'tàu'], ['plane', Plane, 'máy bay'], ['ship', Ship, 'tàu thủy'], ['bike', Bike, 'xe đạp'], ['map', Map, 'bản đồ'], ['map-pin', MapPin, 'vị trí'], ['globe', Globe, 'toàn cầu'], ['compass', Compass, 'la bàn'], ['flag', Flag, 'cờ'], ['home', Home, 'nhà'], ['building', Building2, 'tòa nhà'], ['factory', Factory, 'nhà máy'], ['school', School, 'trường học'], ['hospital', Hospital, 'bệnh viện']] },
  { name: 'Thiên nhiên', icons: [['sun', Sun, 'mặt trời'], ['moon', Moon, 'mặt trăng'], ['cloud-rain', CloudRain, 'mưa'], ['wind', Wind, 'gió'], ['droplet', Droplet, 'giọt nước'], ['flame', Flame, 'lửa'], ['leaf', Leaf, 'lá'], ['tree', TreePine, 'cây'], ['mountain', Mountain, 'núi'], ['thermometer', Thermometer, 'nhiệt độ'], ['umbrella', Umbrella, 'ô dù'], ['zap', Zap, 'năng lượng']] },
  { name: 'Biểu tượng & khác', icons: [['check', CheckCircle2, 'hoàn thành'], ['badge-check', BadgeCheck, 'xác nhận'], ['star', Star, 'ngôi sao'], ['sparkles', Sparkles, 'lấp lánh'], ['diamond', Diamond, 'kim cương'], ['lightbulb', Lightbulb, 'ý tưởng'], ['rocket', Rocket, 'khởi động'], ['puzzle', Puzzle, 'ghép nối'], ['gift', Gift, 'quà tặng'], ['cake', Cake, 'bánh'], ['coffee', Coffee, 'cà phê'], ['utensils', Utensils, 'ăn uống'], ['book', Book, 'sách'], ['book-open', BookOpen, 'đọc sách'], ['file', FileText, 'tài liệu'], ['folder', Folder, 'thư mục'], ['package', Package, 'gói hàng'], ['calculator', Calculator, 'máy tính tay'], ['scale', Scale, 'cân bằng'], ['flask', FlaskConical, 'thí nghiệm'], ['stethoscope', Stethoscope, 'y tế'], ['heart-pulse', HeartPulse, 'sức khỏe'], ['activity', Activity, 'hoạt động'], ['hammer', Hammer, 'búa'], ['wrench', Wrench, 'sửa chữa'], ['paintbrush', Paintbrush, 'cọ vẽ'], ['palette', Palette, 'bảng màu'], ['pen-tool', PenTool, 'thiết kế']] },
];

const ICON_INDEX = new globalThis.Map<string, LucideIcon>(SLIDE_ICON_GROUPS.flatMap((group) => group.icons.map(([id, icon]) => [id, icon] as const)));

export function slideIcon(name: string | undefined): LucideIcon {
  return ICON_INDEX.get(name ?? '') ?? Star;
}
