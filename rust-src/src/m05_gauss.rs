pub fn run() {
    let n = 40usize;
    let dx = 1.0 / (n as f64);
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

    let mut surf_int = 0.0_f64;
    // x=1 faces
    for _ in 0..n { for _ in 0..n { surf_int += 1.0 * dx * dx; } }
    // y=1 faces
    for _ in 0..n { for _ in 0..n { surf_int += 1.0 * dx * dx; } }
    // z=1 faces
    for _ in 0..n { for _ in 0..n { surf_int += 1.0 * dx * dx; } }

    println!("F = (x², y², z²) в кубе [0,1]³");
    println!("Объёмный интеграл div F: {:.6}", vol_int);
    println!("Поверхностный интеграл:   {:.6}", surf_int);
    println!("Аналитически:             3.0");
}
