pub fn run() {
    let h = 1e-6;
    let (x, y, z) = (2.0, 3.0, 1.0);
    let f = |x: f64, y: f64, z: f64| x*x*y + z*z*z;
    let dfdx = (f(x+h, y, z) - f(x-h, y, z)) / (2.0*h);
    let dfdy = (f(x, y+h, z) - f(x, y-h, z)) / (2.0*h);
    let dfdz = (f(x, y, z+h) - f(x, y, z-h)) / (2.0*h);
    println!("Поле: f(x,y,z) = x²y + z³");
    println!("Точка: ({}, {}, {})", x, y, z);
    println!("f = {}", f(x, y, z));
    println!("Численный  ∇f = ({:.6}, {:.6}, {:.6})", dfdx, dfdy, dfdz);
    println!("Аналитический = ({:.6}, {:.6}, {:.6})", 2.0*x*y, x*x, 3.0*z*z);
}
