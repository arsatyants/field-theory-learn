pub fn run() {
    let r = 2.0;
    let n = 200;
    let pi = std::f64::consts::PI;
    let mut scalar_flux = 0.0_f64;
    let mut vector_flux = 0.0_f64;
    for i in 0..n {
        let theta = pi * (i as f64 + 0.5) / n as f64;
        let st = theta.sin();
        for j in 0..n {
            let phi = 2.0*pi * (j as f64 + 0.5) / n as f64;
            let dtheta = pi / n as f64;
            let dphi = 2.0*pi / n as f64;
            let ds = r * r * st * dtheta * dphi;
            let x = r * st * phi.cos();
            let y = r * st * phi.sin();
            let z = r * theta.cos();
            scalar_flux += (x*x + y*y + z*z) * ds;
            vector_flux += r * ds;
        }
    }
    println!("Сфера радиуса R = {}", r);
    println!("Скалярный поток T = r²:  числ. {:.4}  аналит. 4πR⁴ = {:.4}",
             scalar_flux, 4.0*pi*r.powi(4));
    println!("Векторный поток F = r:  числ. {:.4}  аналит. 4πR³ = {:.4}",
             vector_flux, 4.0*pi*r.powi(3));
}
