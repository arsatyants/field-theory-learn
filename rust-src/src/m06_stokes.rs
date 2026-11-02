pub fn run() {
    let r = 3.0;
    let n = 400;
    let pi = std::f64::consts::PI;
    let mut circ = 0.0_f64;
    let dt = 2.0 * pi / (n as f64);
    for i in 0..n {
        let t = i as f64 * dt;
        let tp = t + dt;
        let x = r * t.cos();
        let y = r * t.sin();
        let dx = r * (tp.cos() - t.cos());
        let dy = r * (tp.sin() - t.sin());
        circ += (-y) * dx + x * dy;
    }
    let flux = 2.0 * pi * r * r;
    println!("Поле F = (−y, x, 0), контур: окружность R={}", r);
    println!("Контурный интеграл (численно): {:.6}", circ);
    println!("Поверхностный интеграл (аналит): {:.6}", flux);
    println!("Отн. ошибка: {:.6}%", ((circ - flux)/flux).abs() * 100.0);
}
