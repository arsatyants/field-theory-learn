pub fn run() {
    let r = 2.0;
    let n = 200usize;
    let mut flux = 0.0_f64;

    for i in 0..n {
        let theta = std::f64::consts::PI * (i as f64 + 0.5) / (n as f64);
        let st = theta.sin();
        let ct = theta.cos();
        for j in 0..n {
            let phi = 2.0 * std::f64::consts::PI * (j as f64 + 0.5) / (n as f64);
            let dtheta = std::f64::consts::PI / (n as f64);
            let dphi = 2.0 * std::f64::consts::PI / (n as f64);
            let dS = r * r * st * dtheta * dphi;
            flux += r * dS; // F·n = r для F=(x,y,z)
        }
    }

    let expected = 4.0 * std::f64::consts::PI * r * r * r;
    println!("Численный поток через сферу R={}: {:.6}", r, flux);
    println!("Аналитически 4πR³ = {:.6}", expected);
    println!("Отн. ошибка: {:.6}%", ((flux - expected)/expected).abs() * 100.0);
}
