pub fn run() {
    let n = 40;
    let dx = 1.0 / n as f64;
    let mut vol_int = 0.0_f64;
    for i in 0..n {
        let x = (i as f64 + 0.5) * dx;
        for j in 0..n {
            let y = (j as f64 + 0.5) * dx;
            for k in 0..n {
                let z = (k as f64 + 0.5) * dx;
                vol_int += (2.0*x + 2.0*y + 2.0*z) * dx*dx*dx;
            }
        }
    }
    let surf_int = 1.0 + 1.0 + 1.0;
    println!("Поле F = (x², y², z²), куб [0,1]³");
    println!("Объёмный интеграл div F (числ.): {:.6}", vol_int);
    println!("Поверхностный поток      (точно): {:.6}", surf_int);
}
