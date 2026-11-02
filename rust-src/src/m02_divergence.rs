pub fn run() {
    let h = 1e-6;
    let (x, y, z) = (2.0, 3.0, 1.0);
    let fx = |x: f64, _y: f64, _z: f64| x*x*_y;
    let fy = |_x: f64, y: f64, z: f64| y*z.sin();
    let fz = |_x: f64, _y: f64, z: f64| z*z*z;
    let dfxdx = (fx(x+h, y, z) - fx(x-h, y, z)) / (2.0*h);
    let dfydy = (fy(x, y+h, z) - fy(x, y-h, z)) / (2.0*h);
    let dfzdz = (fz(x, y, z+h) - fz(x, y, z-h)) / (2.0*h);
    let div = dfxdx + dfydy + dfzdz;
    let exact = 2.0*x*y + z.sin() + 3.0*z*z;
    println!("Поле: F = (x²y, y·sin z, z³)");
    println!("Точка: ({}, {}, {})", x, y, z);
    println!("Численная div F = {:.6}", div);
    println!("Аналитическая    = {:.6}", exact);
}
